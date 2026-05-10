#!/usr/bin/env node
// ---------------------------------------------------------------------------
// generate-from-excel.mjs
//
// Usage:
//   node scripts/generate-from-excel.mjs <excel-file> <deck-name> [options]
//
// Options:
//   --title <title>       Deck title (default: deck-name)
//   --logo  <path>        Logo image path to copy into assets/
//   --copyright <text>    Copyright text (default: "© 2026 CORe Inc.")
//   --dry-run             Preview without writing files
//
// Example:
//   node scripts/generate-from-excel.mjs \
//     ~/Downloads/ai_agent_security.xlsx \
//     ai-agent-security \
//     --title "【2026年最新】AIエージェント攻撃手法と対策一覧" \
//     --logo ~/Desktop/logo_blk.png
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { resolve, basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const DECKS_DIR = join(PROJECT_ROOT, "decks");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length < 2 || args[0] === "--help" || args[0] === "-h") {
  console.log(`
Usage: node scripts/generate-from-excel.mjs <excel-file> <deck-name> [options]

Options:
  --title <title>       Deck title
  --logo  <path>        Logo image to copy into deck assets/
  --copyright <text>    Copyright text (default: "© 2026 CORe Inc.")
  --dry-run             Preview without writing files
`);
  process.exit(0);
}

const excelPath = resolve(args[0]);
const deckName = args[1];

function getOpt(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const deckTitle = getOpt("--title") || deckName;
const logoPath = getOpt("--logo");
const copyrightText = getOpt("--copyright") || "© 2026 CORe Inc.";
const dryRun = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Excel columns mapping
// ---------------------------------------------------------------------------

const COL = {
  attackName: "攻撃手法名",
  englishName: "English Official / Common Name",
  targetLayer: "攻撃対象レイヤー",
  overview: "概要",
  category: "区分",
  prevention: "予防策",
  detection: "検知策",
  response: "対応策",
  sourceUrl: "ソースURL",
};

// ---------------------------------------------------------------------------
// Read Excel
// ---------------------------------------------------------------------------

console.log(`Reading: ${excelPath}`);
const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

console.log(`Found ${rows.length} rows in sheet "${sheetName}"`);

if (rows.length === 0) {
  console.error("No data rows found.");
  process.exit(1);
}

// Validate columns
const firstRow = rows[0];
for (const [key, colName] of Object.entries(COL)) {
  if (!(colName in firstRow)) {
    console.error(`Missing column: "${colName}" (mapped as ${key})`);
    console.error(`Available columns: ${Object.keys(firstRow).join(", ")}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Setup deck directory
// ---------------------------------------------------------------------------

const deckDir = join(DECKS_DIR, deckName);
const assetsDir = join(deckDir, "assets");

if (!dryRun) {
  mkdirSync(assetsDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Copy logo if provided
// ---------------------------------------------------------------------------

let logoConfig = "";
if (logoPath && existsSync(logoPath)) {
  const logoExt = extname(logoPath);
  const logoFilename = `logo${logoExt}`;
  if (!dryRun) {
    copyFileSync(logoPath, join(assetsDir, logoFilename));
  }
  logoConfig = `
  logo: {
    src: "./assets/${logoFilename}",
    position: "top-right",
  },`;
  console.log(`Logo copied: ${logoFilename}`);
}

// ---------------------------------------------------------------------------
// Generate deck.config.ts
// ---------------------------------------------------------------------------

const deckConfig = `import { defineConfig } from "../../src/lib/deck-config";

export default defineConfig({
  title: ${JSON.stringify(deckTitle)},${logoConfig}
  copyright: {
    text: ${JSON.stringify(copyrightText)},
    position: "bottom-right",
  },
  pageNumber: {
    position: "bottom-left",
    hideOnCover: true,
  },
  theme: {
    colors: {
      primary: "#0097A7",
      secondary: "#5E35B1",
      background: "#FFFFFF",
      text: "#1A1A2E",
      textMuted: "#5A6B7D",
      textSubtle: "#8899AA",
      surface: "#F0F2F5",
    },
    fonts: {
      heading: "'Noto Sans JP', sans-serif",
      body: "'Noto Sans JP', sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
  },
  transition: "fade",
});
`;

writeFile("deck.config.ts", deckConfig);

// ---------------------------------------------------------------------------
// Generate cover slide
// ---------------------------------------------------------------------------

const coverMdx = `---
type: cover
transition: fade
verticalAlign: center
notes: |
  デッキの表紙スライド。
---

<ShowcaseCover
  variant="split-band"
  eyebrow="2026 EDITION"
  title=${JSON.stringify(deckTitle)}
  subtitle="AI Agent Attack Vectors & Countermeasures"
  description="AIエージェントに対する攻撃手法を体系的に整理し、予防策・検知策・対応策を一覧化"
  tags={["OWASP", "NIST", "CVE"]}
  hint="CORe Inc."
/>
`;

writeFile("01-cover.mdx", coverMdx);

// ---------------------------------------------------------------------------
// Generate content slides
// ---------------------------------------------------------------------------

rows.forEach((row, index) => {
  const num = index + 1;
  const padNum = String(num + 1).padStart(2, "0"); // 02, 03, ...
  const displayNum = String(num).padStart(2, "0"); // #01, #02, ...

  const attackName = str(row[COL.attackName]);
  const englishName = str(row[COL.englishName]);
  const targetLayer = str(row[COL.targetLayer]);
  const overview = str(row[COL.overview]);
  const category = str(row[COL.category]);
  const prevention = str(row[COL.prevention]);
  const detection = str(row[COL.detection]);
  const response = str(row[COL.response]);
  const sourceUrls = parseUrls(str(row[COL.sourceUrl]));

  // Build slug from english name
  const slug = englishName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const filename = `${padNum}-${slug || `attack-${num}`}.mdx`;

  // Build source links JSX
  const sourceJsx = sourceUrls.length > 0
    ? sourceUrls
        .map((url) => {
          const display = url.replace(/^https?:\/\//, "");
          return `<a href="${url}" style={{ color: "var(--slide-primary)" }}>${escapeJsx(display)}</a>`;
        })
        .join(" | ")
    : "";

  // Escape special characters for YAML notes
  const notesOverview = overview.replace(/"/g, '\\"').replace(/:/g, "：");

  const mdx = `---
type: content
transition: fade
notes: |
  Purpose: ${escapeYaml(attackName)}の攻撃概要と対策を解説する。
  Talking Points:
    - ${escapeYaml(overview)}
    - 攻撃対象レイヤー：${escapeYaml(targetLayer)}
    - 区分：${escapeYaml(category)}
  Estimated Time: 2 minutes
---

<style>
{\`
  .measure-card {
    background: #F5F7FA;
    border: 1px solid #E2E6EC;
    border-radius: 8px;
    padding: 1.5rem;
    flex: 1;
    min-width: 0;
  }
\`}
</style>

<div style={{
  display: "flex",
  flexDirection: "column",
  height: "100%",
  gap: "var(--slide-space-sm)"
}}>

  {/* Header */}
  <div>
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
      <span style={{
        fontFamily: "monospace",
        fontSize: "1.8rem",
        color: "#02001A",
        fontWeight: 700
      }}>#${displayNum}</span>
      <span style={{
        fontSize: "1.5rem",
        color: "#02001A",
        padding: "0.2rem 0.8rem",
        background: "#ECEDF0",
        borderRadius: "4px"
      }}>${escapeJsx(targetLayer)}</span>
      <span style={{
        fontSize: "1.5rem",
        color: "#02001A",
        padding: "0.2rem 0.8rem",
        background: "#ECEDF0",
        borderRadius: "4px"
      }}>${escapeJsx(category)}</span>
    </div>

    <h2 style={{
      fontSize: "2.8rem",
      fontWeight: 700,
      margin: "0 0 0.3rem 0",
      color: "var(--slide-text)"
    }}>${escapeJsx(attackName)}</h2>

    <p style={{
      fontSize: "1.8rem",
      color: "var(--slide-text-muted)",
      margin: 0
    }}>${escapeJsx(englishName)}</p>
  </div>

  {/* Overview */}
  <div style={{
    background: "#F5F7FA",
    borderRadius: "8px",
    padding: "1.2rem 1.5rem"
  }}>
    <p style={{
      fontSize: "2rem",
      color: "var(--slide-text)",
      margin: 0,
      lineHeight: 1.6
    }}>${escapeJsx(overview)}</p>
  </div>

  {/* Three columns: Prevention / Detection / Response */}
  <div style={{
    display: "flex",
    gap: "1rem",
    flex: 1,
    minHeight: 0
  }}>

    <div className="measure-card">
      <p style={{
        fontSize: "1.8rem",
        fontWeight: 700,
        color: "#4A6FA5",
        margin: "0 0 0.8rem 0"
      }}>予防策</p>
      <p style={{
        fontSize: "1.8rem",
        color: "var(--slide-text-muted)",
        margin: 0,
        lineHeight: 1.6
      }}>${escapeJsx(prevention)}</p>
    </div>

    <div className="measure-card">
      <p style={{
        fontSize: "1.8rem",
        fontWeight: 700,
        color: "#1B3A5C",
        margin: "0 0 0.8rem 0"
      }}>検知策</p>
      <p style={{
        fontSize: "1.8rem",
        color: "var(--slide-text-muted)",
        margin: 0,
        lineHeight: 1.6
      }}>${escapeJsx(detection)}</p>
    </div>

    <div className="measure-card">
      <p style={{
        fontSize: "1.8rem",
        fontWeight: 700,
        color: "#0A1E3D",
        margin: "0 0 0.8rem 0"
      }}>対応策</p>
      <p style={{
        fontSize: "1.8rem",
        color: "var(--slide-text-muted)",
        margin: 0,
        lineHeight: 1.6
      }}>${escapeJsx(response)}</p>
    </div>

  </div>

  {/* Source */}
  <div>
    <p style={{
      fontSize: "1.4rem",
      color: "var(--slide-text-subtle)",
      margin: 0,
      fontFamily: "monospace"
    }}>${sourceJsx ? `Source: ${sourceJsx}` : ""}</p>
  </div>

</div>
`;

  writeFile(filename, mdx);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n✅ Generated ${rows.length + 2} files in decks/${deckName}/`);
console.log(`   - deck.config.ts`);
console.log(`   - 01-cover.mdx`);
console.log(`   - ${String(rows.length).padStart(2, "0")} content slides (02-xx.mdx ~ ${String(rows.length + 1).padStart(2, "0")}-xx.mdx)`);
if (dryRun) {
  console.log(`\n⚠️  Dry run — no files were written.`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeFile(filename, content) {
  const filePath = join(deckDir, filename);
  if (dryRun) {
    console.log(`  [dry-run] ${filename}`);
  } else {
    writeFileSync(filePath, content, "utf-8");
    console.log(`  ✓ ${filename}`);
  }
}

function str(val) {
  return val == null ? "" : String(val).trim();
}

function parseUrls(raw) {
  if (!raw) return [];
  return raw
    .split(/[\n\r]+/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));
}

function escapeJsx(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
}

function escapeYaml(text) {
  return text.replace(/\n/g, " ").replace(/"/g, "'");
}
