import * as fs from "node:fs";
import * as path from "node:path";
import type { Finding } from "../../lib/findings";
import type { DeckContext } from "../context";

/** Mirrors ALLOWED_EXTENSIONS in src/app/api/decks/[...path]/route.ts. */
const SERVABLE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
  ".mp4", ".webm", ".pdf", ".woff", ".woff2", ".ttf", ".otf",
]);

interface AssetRef {
  /** Path relative to the deck's assets/ directory. */
  rel: string;
  file: string;
  line?: number;
  snippet?: string;
}

function collectMdxAssetRefs(ctx: DeckContext): { refs: AssetRef[]; dynamic: AssetRef[] } {
  const refs: AssetRef[] = [];
  const dynamic: AssetRef[] = [];
  // Same three lead-in forms that resolveAssetPaths() rewrites.
  const staticRe = /[("']\.\/assets\/([^"')\s>]+)/g;
  const templateRe = /`[^`]*\.\/assets\/[^`]*`/g;

  for (const slide of ctx.slides) {
    const lines = slide.raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const match of line.matchAll(staticRe)) {
        refs.push({ rel: decodeURIComponent(match[1]), file: slide.repoPath, line: i + 1, snippet: line.trim() });
      }
      for (const match of line.matchAll(templateRe)) {
        dynamic.push({ rel: match[0], file: slide.repoPath, line: i + 1, snippet: line.trim() });
      }
    }
  }
  return { refs, dynamic };
}

/** Logo `src` forms accepted by SlideOverlay.resolveAssetPath(). */
function logoAssetRel(src: string | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("http") || src.startsWith("/")) return null;
  if (src.startsWith("./assets/")) return src.slice("./assets/".length);
  return src;
}

function walkFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, base));
    else if (entry.isFile() && entry.name !== ".gitkeep" && entry.name !== ".DS_Store") {
      out.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

export function checkAssets(ctx: DeckContext): Finding[] {
  const findings: Finding[] = [];
  const assetsDir = path.join(ctx.deckDir, "assets");
  const onDisk = walkFiles(assetsDir);
  const onDiskSet = new Set(onDisk);
  const referenced = new Set<string>();

  const { refs, dynamic } = collectMdxAssetRefs(ctx);

  const logoRel = logoAssetRel(ctx.config?.logo?.src);
  if (logoRel) refs.push({ rel: logoRel, file: `${ctx.repoDir}/deck.config.ts`, snippet: `logo.src: "${ctx.config?.logo?.src}"` });

  for (const slide of ctx.slides) {
    const slideLogo = logoAssetRel(slide.data?.frontmatter.logo?.src);
    if (slideLogo) refs.push({ rel: slideLogo, file: slide.repoPath, snippet: `logo.src: "${slide.data?.frontmatter.logo?.src}"` });
  }

  for (const ref of refs) {
    const clean = ref.rel.split(/[?#]/)[0];
    referenced.add(clean);
    if (!onDiskSet.has(clean)) {
      findings.push({
        deck: ctx.deckName,
        check: "assets",
        rule: "asset-missing",
        severity: "error",
        message: `Referenced asset does not exist: assets/${clean}`,
        file: ref.file,
        line: ref.line,
        snippet: ref.snippet,
      });
      continue;
    }
    const ext = path.extname(clean).toLowerCase();
    if (!SERVABLE_EXTENSIONS.has(ext)) {
      findings.push({
        deck: ctx.deckName,
        check: "assets",
        rule: "asset-not-servable",
        severity: "warning",
        message: `assets/${clean} has extension "${ext}" which the asset API does not serve (403 at render time)`,
        file: ref.file,
        line: ref.line,
        snippet: ref.snippet,
      });
    }
  }

  for (const ref of dynamic) {
    findings.push({
      deck: ctx.deckName,
      check: "assets",
      rule: "asset-path-dynamic",
      severity: "warning",
      message: "./assets/ inside a template literal is not rewritten to the asset API; use a plain string",
      file: ref.file,
      line: ref.line,
      snippet: ref.snippet,
    });
  }

  for (const file of onDisk) {
    if (referenced.has(file)) continue;
    const ext = path.extname(file).toLowerCase();
    findings.push({
      deck: ctx.deckName,
      check: "assets",
      rule: SERVABLE_EXTENSIONS.has(ext) ? "asset-unused" : "asset-unused-not-servable",
      severity: SERVABLE_EXTENSIONS.has(ext) ? "warning" : "info",
      message: `assets/${file} is not referenced by any slide or deck.config.ts`,
      file: `${ctx.repoDir}/assets/${file}`,
    });
  }

  return findings;
}
