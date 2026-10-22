import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

interface ThreeSupport {
  version: string;
  license: string;
  imports: Record<string, string>;
}

const require = createRequire(import.meta.url);
const cached = new Map<string, Promise<ThreeSupport>>();
const DEFAULT_ADDONS = ["controls/OrbitControls.js", "loaders/GLTFLoader.js", "capabilities/WebGL.js"];

export function parseThreeAddons(value: string | undefined): string[] {
  if (!value) return [];
  const addons = value.split(",").map((name) => name.trim()).filter(Boolean);
  for (const name of addons) {
    if (!name.endsWith(".js") || name.startsWith("/") || name.includes("\\") || name.includes("\0") ||
      name.split("/").some((part) => !part || part.startsWith("."))) throw new Error(`Invalid Three.js addon path: ${name}`);
  }
  return addons;
}

/** Browser ESM bundles embedded as data URLs, sharing one Three.js module instance. */
export function buildThreeSupport(addons: string[] = []): Promise<ThreeSupport> {
  const selected = [...new Set([...DEFAULT_ADDONS, ...parseThreeAddons(addons.join(","))])].sort();
  const key = selected.join(",");
  const previous = cached.get(key);
  if (previous) return previous;
  const pending = (async () => {
    const root = path.resolve(path.dirname(require.resolve("three")), "..");
    const metadata = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")) as { version: string };
    const license = await fs.readFile(path.join(root, "LICENSE"), "utf8");
    const addonRoot = await fs.realpath(path.join(root, "examples/jsm"));
    const entries = [["three", path.join(root, "build/three.module.js")]];
    for (const addon of selected) {
      const file = await fs.realpath(path.join(addonRoot, addon));
      const relative = path.relative(addonRoot, file);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Addon path escapes the Three.js package");
      entries.push([`three/addons/${addon}`, file]);
    }
    const bundled = await Promise.all(entries.map(async ([name, entry]) => {
      const result = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "browser",
        target: "es2020", minify: true, legalComments: "inline", write: false,
        external: name === "three" ? [] : ["three"], logLevel: "silent" });
      return [name, `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`] as const;
    }));
    return { version: metadata.version, license, imports: Object.fromEntries(bundled) };
  })();
  cached.set(key, pending);
  return pending;
}

const IMPORT_MAP = /<script\b(?=[^>]*\btype\s*=\s*(?:"importmap"|'importmap'|importmap\b))[^>]*>[\s\S]*?<\/script\s*>/gi;
const OWN_LICENSE = /<!-- amaroad-three-license[\s\S]*?-->/g;

export async function enableThreeInHtml(html: string, addons: string[] = []): Promise<{ html: string; version: string }> {
  const support = await buildThreeSupport(addons);
  const maps = [...html.matchAll(IMPORT_MAP)];
  if (maps.length > 1) throw new Error("Multiple import maps found; merge them before adding Three.js");
  let map: Record<string, unknown> = {};
  const existing = maps[0]?.[0];
  if (existing) {
    const body = existing.slice(existing.indexOf(">") + 1).replace(/<\/script\s*>$/i, "");
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid import map");
    map = parsed as Record<string, unknown>;
  }
  const imports = map.imports;
  if (imports !== undefined && (!imports || typeof imports !== "object" || Array.isArray(imports))) throw new Error("Invalid import map imports");
  const existingImports = (imports ?? {}) as Record<string, unknown>;
  if (existing && !/\bdata-amaroad-three\s*=/.test(existing)) {
    const conflict = Object.keys(existingImports).find((name) => name === "three" || name.startsWith("three/"));
    if (conflict) throw new Error(`Import map already defines "${conflict}"; it was not overwritten`);
  }
  const scopes = map.scopes;
  if (scopes && typeof scopes === "object") {
    for (const scope of Object.values(scopes)) {
      if (scope && typeof scope === "object" && Object.keys(scope).some((name) => name === "three" || name.startsWith("three/"))) {
        throw new Error("Scoped Three.js mappings already exist; they were not overwritten");
      }
    }
  }
  const json = JSON.stringify({ ...map, imports: { ...existingImports, ...support.imports } }).replaceAll("<", "\\u003c");
  let opening = existing ? existing.slice(0, existing.indexOf(">") + 1) : '<script type="importmap">';
  if (/\bdata-amaroad-three\s*=/.test(opening)) {
    opening = opening.replace(/\bdata-amaroad-three\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/, () => `data-amaroad-three="${support.version}"`);
  } else opening = opening.replace(/>$/, () => ` data-amaroad-three="${support.version}">`);
  const script = `${opening}${json}</script>`;
  let output = existing ? html.replace(existing, () => script) : html;
  if (!existing) {
    if (/<head\b[^>]*>/i.test(output)) output = output.replace(/<head\b[^>]*>/i, (head) => head + "\n" + script);
    else if (/<html\b[^>]*>/i.test(output)) output = output.replace(/<html\b[^>]*>/i, (element) => element + `<head>${script}</head>`);
    else if (/<!doctype\b[^>]*>/i.test(output)) output = output.replace(/<!doctype\b[^>]*>/i, (doctype) => doctype + script);
    else output = script + output;
  }
  output = output.replace(OWN_LICENSE, "").trimEnd();
  const notice = `\n<!-- amaroad-three-license\nThree.js ${support.version}\n${support.license.replaceAll("-->", "-- >")}-->\n`;
  return { html: output + notice, version: support.version };
}
