/**
 * `pnpm amaroad catalog [--check]`
 *
 * Generates docs/components.md and docs/components.json from the MDX
 * component registry (`slideComponents` in src/components/mdx/index.tsx)
 * using the TypeScript compiler API, so the documented props can never drift
 * from the implementation. `--check` exits 1 when the committed files are
 * stale (run in CI).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import { die, getBoolean, getString, rejectUnknownFlags, type ParsedArgs } from "../lib/cli";
import { findProjectRoot } from "../lib/decks";

const REGISTRY_FILE = "src/components/mdx/index.tsx";
const REGISTRY_EXPORT = "slideComponents";
const DOCS_MD = "docs/components.md";
const DOCS_JSON = "docs/components.json";

// ---------------------------------------------------------------------------
// Catalog model
// ---------------------------------------------------------------------------

export interface PropDoc {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description?: string;
  /** Present when the type is a union of string/number literals. */
  values?: string[];
}

export interface NestedTypeDoc {
  name: string;
  props: PropDoc[];
}

export interface ComponentDoc {
  name: string;
  category: string;
  file: string;
  description?: string;
  props: PropDoc[];
  /** Item shapes referenced by array props (e.g. FeatureItem for `items`). */
  nested: NestedTypeDoc[];
  /** Human summary of inherited prop bags (HTML attributes, lucide props). */
  inherits: string[];
  acceptsChildren: boolean;
  acceptsStyle: boolean;
}

export interface Catalog {
  generatedBy: string;
  registry: string;
  htmlOverrides: Array<{ tag: string; component: string; file: string }>;
  components: ComponentDoc[];
}

// ---------------------------------------------------------------------------
// TypeScript program
// ---------------------------------------------------------------------------

function createProgram(projectRoot: string): ts.Program {
  const configPath = path.join(projectRoot, "tsconfig.json");
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diag) => {
        die(ts.flattenDiagnosticMessageText(diag.messageText, "\n"));
      },
    },
  );
  if (!parsed) die("Could not parse tsconfig.json");
  // Only the registry root is needed; the checker pulls in its imports.
  const rootNames = [path.join(projectRoot, REGISTRY_FILE)];
  return ts.createProgram({ rootNames, options: { ...parsed.options, noEmit: true } });
}

function isNodeModulesPath(file: string): boolean {
  return file.includes(`${path.sep}node_modules${path.sep}`) || file.includes("/node_modules/");
}

function docText(symbol: ts.Symbol, checker: ts.TypeChecker): string | undefined {
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
  return text || undefined;
}

function literalValues(type: ts.Type): string[] | undefined {
  if (!type.isUnion()) {
    if (type.isStringLiteral()) return [type.value];
    return undefined;
  }
  const values: string[] = [];
  for (const member of type.types) {
    if (member.isStringLiteral()) values.push(member.value);
    else if (member.isNumberLiteral()) values.push(String(member.value));
    else if (member.flags & ts.TypeFlags.BooleanLiteral) continue; // plain `boolean`
    else if (member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) continue;
    else return undefined;
  }
  return values.length > 0 ? values : undefined;
}

/**
 * The checker orders union members by internal id; prefer the order the
 * author wrote (`"a" | "b"`, possibly behind a type alias).
 */
function declaredLiteralOrder(symbol: ts.Symbol, checker: ts.TypeChecker): string[] | undefined {
  const decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (!decl || !(ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) || !decl.type) return undefined;
  let typeNode: ts.TypeNode | undefined = decl.type;
  for (let hops = 0; typeNode && ts.isTypeReferenceNode(typeNode) && hops < 4; hops++) {
    const refSymbol = checker.getSymbolAtLocation(typeNode.typeName);
    const aliasDecl = refSymbol?.declarations?.find(ts.isTypeAliasDeclaration);
    typeNode = aliasDecl?.type;
  }
  if (!typeNode || !ts.isUnionTypeNode(typeNode)) return undefined;
  const values: string[] = [];
  for (const member of typeNode.types) {
    if (ts.isLiteralTypeNode(member) && (ts.isStringLiteral(member.literal) || ts.isNumericLiteral(member.literal))) {
      values.push(member.literal.text);
    } else if (member.kind === ts.SyntaxKind.UndefinedKeyword) {
      continue;
    } else {
      return undefined;
    }
  }
  return values.length > 1 ? values : undefined;
}

function typeText(type: ts.Type, checker: ts.TypeChecker, location: ts.Node): string {
  const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
  let text = checker.typeToString(type, location, flags);
  // Optional props show as `X | undefined`; the `required` column already says so.
  text = text.replace(/\s*\|\s*undefined$/, "").replace(/^undefined\s*\|\s*/, "");
  return text;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

interface RegistryEntry {
  key: string;
  identifier: string;
  category: string;
}

function readRegistry(sf: ts.SourceFile): RegistryEntry[] {
  const entries: RegistryEntry[] = [];
  let objectLiteral: ts.ObjectLiteralExpression | undefined;

  ts.forEachChild(sf, (node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === REGISTRY_EXPORT && decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
        objectLiteral = decl.initializer;
      }
    }
  });
  if (!objectLiteral) die(`Could not find \`export const ${REGISTRY_EXPORT} = {...}\` in ${REGISTRY_FILE}`);

  const text = sf.getFullText();
  let category = "Other";
  for (const prop of objectLiteral.properties) {
    // Category headings are `// Layout`-style comments before a property.
    const ranges = ts.getLeadingCommentRanges(text, prop.getFullStart()) ?? [];
    for (const range of ranges) {
      const comment = text.slice(range.pos, range.end).replace(/^\/\/\s*|^\/\*+\s*|\s*\*+\/$/g, "").trim();
      if (comment) category = comment;
    }
    if (ts.isShorthandPropertyAssignment(prop)) {
      entries.push({ key: prop.name.text, identifier: prop.name.text, category });
    } else if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.initializer)) {
      const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : prop.name.getText();
      entries.push({ key, identifier: prop.initializer.text, category });
    }
  }
  return entries;
}

function resolveComponentDeclaration(
  sf: ts.SourceFile,
  identifier: string,
  checker: ts.TypeChecker,
): ts.FunctionDeclaration | ts.VariableDeclaration | undefined {
  let found: ts.FunctionDeclaration | ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isIdentifier(node) && node.text === identifier && ts.isImportSpecifier(node.parent)) {
      let symbol = checker.getSymbolAtLocation(node);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const decl = symbol?.declarations?.[0];
      if (decl && (ts.isFunctionDeclaration(decl) || ts.isVariableDeclaration(decl))) found = decl;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function firstParameter(decl: ts.FunctionDeclaration | ts.VariableDeclaration): ts.ParameterDeclaration | undefined {
  if (ts.isFunctionDeclaration(decl)) return decl.parameters[0];
  const init = decl.initializer;
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) return init.parameters[0];
  // memo(function X(props) {...}) / forwardRef(...)
  if (init && ts.isCallExpression(init)) {
    const arg = init.arguments[0];
    if (arg && (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))) return arg.parameters[0];
  }
  return undefined;
}

function collectDefaults(param: ts.ParameterDeclaration): Map<string, string> {
  const defaults = new Map<string, string>();
  if (!ts.isObjectBindingPattern(param.name)) return defaults;
  for (const element of param.name.elements) {
    if (!element.initializer) continue;
    const name = element.propertyName
      ? element.propertyName.getText()
      : element.name.getText();
    defaults.set(name, element.initializer.getText().replace(/\s+/g, " "));
  }
  return defaults;
}

const INHERITED_LABELS: Array<[RegExp, string]> = [
  [/lucide-react/, "LucideProps (size, color, strokeWidth, className, style, …)"],
  [/@types\/react/, "React HTML attributes for the underlying element"],
  [/lib\.dom/, "DOM attributes"],
];

function describeInherited(file: string): string {
  for (const [re, label] of INHERITED_LABELS) if (re.test(file)) return label;
  return `props from ${path.basename(file)}`;
}

interface ExtractResult {
  props: PropDoc[];
  nested: NestedTypeDoc[];
  inherits: string[];
  acceptsChildren: boolean;
  acceptsStyle: boolean;
}

function extractProps(
  param: ts.ParameterDeclaration | undefined,
  checker: ts.TypeChecker,
  componentFile: string,
): ExtractResult {
  const result: ExtractResult = { props: [], nested: [], inherits: [], acceptsChildren: false, acceptsStyle: false };
  if (!param) return result;

  const type = checker.getTypeAtLocation(param);
  const defaults = collectDefaults(param);
  const nestedSeen = new Set<string>();
  const inheritedFiles = new Set<string>();

  for (const symbol of checker.getPropertiesOfType(type)) {
    const decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
    const declFile = decl?.getSourceFile().fileName ?? "";
    if (declFile && isNodeModulesPath(declFile)) {
      if (symbol.name === "children") result.acceptsChildren = true;
      if (symbol.name === "style") result.acceptsStyle = true;
      inheritedFiles.add(declFile);
      continue;
    }

    const propType = checker.getTypeOfSymbolAtLocation(symbol, param);
    const required = !(symbol.flags & ts.SymbolFlags.Optional);
    const nonNull = checker.getNonNullableType(propType);
    const doc: PropDoc = {
      name: symbol.name,
      type: typeText(propType, checker, param),
      required,
    };
    const def = defaults.get(symbol.name);
    if (def !== undefined) doc.default = def;
    const description = docText(symbol, checker);
    if (description) doc.description = description;
    const values = declaredLiteralOrder(symbol, checker) ?? literalValues(nonNull);
    if (values && values.length > 1) doc.values = values;

    if (symbol.name === "children") result.acceptsChildren = true;
    if (symbol.name === "style") result.acceptsStyle = true;

    // Expand `Item[]` element types declared in the project (one level).
    const elementType = checker.isArrayType(nonNull) ? checker.getTypeArguments(nonNull as ts.TypeReference)[0] : undefined;
    const target = elementType ? checker.getNonNullableType(elementType) : undefined;
    if (target && target.getSymbol() && target.flags & ts.TypeFlags.Object) {
      const targetSymbol = target.getSymbol()!;
      const targetDecl = targetSymbol.declarations?.[0];
      const targetFile = targetDecl?.getSourceFile().fileName ?? "";
      const targetName = targetSymbol.getName();
      if (targetFile && !isNodeModulesPath(targetFile) && targetName !== "__type" && !nestedSeen.has(targetName)) {
        nestedSeen.add(targetName);
        const nestedProps: PropDoc[] = [];
        for (const member of checker.getPropertiesOfType(target)) {
          const memberType = checker.getTypeOfSymbolAtLocation(member, targetDecl ?? param);
          const memberDoc: PropDoc = {
            name: member.name,
            type: typeText(memberType, checker, param),
            required: !(member.flags & ts.SymbolFlags.Optional),
          };
          const memberDesc = docText(member, checker);
          if (memberDesc) memberDoc.description = memberDesc;
          const memberValues = declaredLiteralOrder(member, checker) ?? literalValues(checker.getNonNullableType(memberType));
          if (memberValues && memberValues.length > 1) memberDoc.values = memberValues;
          nestedProps.push(memberDoc);
        }
        result.nested.push({ name: targetName, props: nestedProps });
      }
    }

    result.props.push(doc);
  }

  for (const file of inheritedFiles) result.inherits.push(describeInherited(file));
  result.inherits = Array.from(new Set(result.inherits));
  void componentFile;
  return result;
}

function componentDescription(decl: ts.FunctionDeclaration | ts.VariableDeclaration, checker: ts.TypeChecker): string | undefined {
  const node = ts.isVariableDeclaration(decl) ? decl.parent.parent : decl;
  const jsDocs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  const text = jsDocs
    .map((d) => (typeof d.comment === "string" ? d.comment : ts.getTextOfJSDocComment(d.comment) ?? ""))
    .join("\n")
    .trim();
  if (text) return text;
  const symbol = decl.name && ts.isIdentifier(decl.name) ? checker.getSymbolAtLocation(decl.name) : undefined;
  return symbol ? docText(symbol, checker) : undefined;
}

export function buildCatalog(projectRoot: string): Catalog {
  const program = createProgram(projectRoot);
  const checker = program.getTypeChecker();
  const registryPath = path.join(projectRoot, REGISTRY_FILE);
  const sf = program.getSourceFile(registryPath);
  if (!sf) die(`Registry source not in program: ${REGISTRY_FILE}`);

  const catalog: Catalog = {
    generatedBy: "pnpm amaroad catalog",
    registry: REGISTRY_FILE,
    htmlOverrides: [],
    components: [],
  };

  for (const entry of readRegistry(sf)) {
    const decl = resolveComponentDeclaration(sf, entry.identifier, checker);
    if (!decl) {
      process.stderr.write(`warning: could not resolve ${entry.identifier} (registry key "${entry.key}")\n`);
      continue;
    }
    const file = path.relative(projectRoot, decl.getSourceFile().fileName).split(path.sep).join("/");
    const isHtmlTag = /^[a-z]/.test(entry.key);
    if (isHtmlTag) {
      catalog.htmlOverrides.push({ tag: entry.key, component: entry.identifier, file });
      continue;
    }
    const extracted = extractProps(firstParameter(decl), checker, file);
    const doc: ComponentDoc = {
      name: entry.key,
      category: entry.category,
      file,
      props: extracted.props,
      nested: extracted.nested,
      inherits: extracted.inherits,
      acceptsChildren: extracted.acceptsChildren,
      acceptsStyle: extracted.acceptsStyle,
    };
    const description = componentDescription(decl, checker);
    if (description) doc.description = description;
    catalog.components.push(doc);
  }

  return catalog;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function mdEscape(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n+/g, " ");
}

function code(text: string): string {
  return "`" + text.replace(/`/g, "'") + "`";
}

function renderPropsTable(props: PropDoc[]): string[] {
  if (props.length === 0) return ["_No props._", ""];
  const lines = ["| prop | type | required | default | description |", "|---|---|:-:|---|---|"];
  for (const p of props) {
    const type = p.values ? p.values.map((v) => code(JSON.stringify(v).replace(/^"|"$/g, '"'))).join(" \\| ") : code(p.type);
    lines.push(
      `| ${code(p.name)} | ${type} | ${p.required ? "yes" : ""} | ${p.default !== undefined ? code(p.default) : ""} | ${p.description ? mdEscape(p.description) : ""} |`,
    );
  }
  lines.push("");
  return lines;
}

export function renderCatalogMarkdown(catalog: Catalog): string {
  const lines: string[] = [];
  lines.push("# Amaroad MDX Component Catalog", "");
  lines.push(
    `> Generated by \`${catalog.generatedBy}\` from \`${catalog.registry}\`. Do not edit by hand; run \`pnpm amaroad catalog\` after changing a component.`,
    "",
  );
  lines.push(
    "This is the authoritative list of components and props available inside slide `.mdx` files. Props not listed here do not exist.",
    "",
    "Conventions:",
    "- `style` accepts inline styles and CSS-variable overrides (`--{component}-{variant}-{property}`).",
    "- `children` means the component wraps MDX content; never use Markdown list syntax inside it (use `<p>` with `・` or nested cards).",
    "- Slide text must be 1.8rem or larger; prefer `var(--slide-*)` colors over hex literals.",
    "",
  );

  const categories = new Map<string, ComponentDoc[]>();
  for (const c of catalog.components) {
    const list = categories.get(c.category) ?? [];
    list.push(c);
    categories.set(c.category, list);
  }

  lines.push("## Index", "");
  for (const [category, comps] of categories) {
    lines.push(`- **${category}**: ${comps.map((c) => `[${c.name}](#${c.name.toLowerCase()})`).join(", ")}`);
  }
  lines.push(`- **Styled HTML**: ${catalog.htmlOverrides.map((o) => code(o.tag)).join(", ")} (Markdown syntax renders through slide-styled components; no extra props)`, "");

  for (const [category, comps] of categories) {
    lines.push(`## ${category}`, "");
    for (const c of comps) {
      lines.push(`### ${c.name}`, "");
      lines.push(`Source: \`${c.file}\``, "");
      if (c.description) lines.push(c.description, "");
      const notes: string[] = [];
      if (c.acceptsChildren) notes.push("accepts `children`");
      if (c.acceptsStyle) notes.push("accepts `style` (CSS variable overrides)");
      for (const inh of c.inherits) notes.push(`inherits ${inh}`);
      if (notes.length > 0) lines.push(`_${notes.join("; ")}._`, "");
      lines.push(...renderPropsTable(c.props));
      for (const nested of c.nested) {
        lines.push(`#### ${nested.name}`, "");
        lines.push(...renderPropsTable(nested.props));
      }
    }
  }

  lines.push("## Styled HTML overrides", "");
  lines.push("| tag | component | source |", "|---|---|---|");
  for (const o of catalog.htmlOverrides) lines.push(`| ${code(o.tag)} | ${code(o.component)} | \`${o.file}\` |`);
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

const USAGE = `Usage: pnpm amaroad catalog [--check] [--out-dir docs]

Generates ${DOCS_MD} and ${DOCS_JSON} from the MDX component registry.
  --check     Do not write; exit 1 if the committed files are out of date
  --out-dir   Output directory (default: docs)
  --help      Show help`;

export async function runCatalogCommand(args: ParsedArgs): Promise<void> {
  if (getBoolean(args, "help") || getBoolean(args, "h")) {
    process.stdout.write(USAGE + "\n");
    return;
  }
  rejectUnknownFlags(args, ["check", "out-dir"]);

  const projectRoot = findProjectRoot();
  const outDir = path.resolve(projectRoot, getString(args, "out-dir") ?? "docs");
  const mdPath = path.join(outDir, path.basename(DOCS_MD));
  const jsonPath = path.join(outDir, path.basename(DOCS_JSON));

  const catalog = buildCatalog(projectRoot);
  const md = renderCatalogMarkdown(catalog);
  const json = JSON.stringify(catalog, null, 2) + "\n";

  if (getBoolean(args, "check")) {
    const stale: string[] = [];
    if (!fs.existsSync(mdPath) || fs.readFileSync(mdPath, "utf-8") !== md) stale.push(path.relative(projectRoot, mdPath));
    if (!fs.existsSync(jsonPath) || fs.readFileSync(jsonPath, "utf-8") !== json) stale.push(path.relative(projectRoot, jsonPath));
    if (stale.length > 0) {
      process.stderr.write(`Component catalog is out of date: ${stale.join(", ")}\nRun: pnpm amaroad catalog\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`Component catalog is up to date (${catalog.components.length} components).\n`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(mdPath, md, "utf-8");
  fs.writeFileSync(jsonPath, json, "utf-8");
  process.stdout.write(
    `Wrote ${path.relative(projectRoot, mdPath)} and ${path.relative(projectRoot, jsonPath)} (${catalog.components.length} components, ${catalog.htmlOverrides.length} HTML overrides).\n`,
  );
}
