#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const mode = process.argv[2];
const validModes = new Set(["--update", "--check"]);
if (!validModes.has(mode)) {
  console.error("Usage: node scripts/third-party-notices.mjs --update|--check");
  process.exit(1);
}

const rootDir = process.cwd();
const pnpmDir = path.join(rootDir, "node_modules", ".pnpm");
const noticesPath = path.join(rootDir, "THIRD_PARTY_NOTICES.md");

if (!fs.existsSync(pnpmDir)) {
  console.error(
    "node_modules/.pnpm not found. Run `pnpm install` before running notices.",
  );
  process.exit(1);
}

function normalizeLicense(pkg) {
  const { license, licenses } = pkg;
  if (typeof license === "string" && license.length > 0) return license;
  if (license && typeof license === "object" && typeof license.type === "string") {
    return license.type;
  }
  if (Array.isArray(licenses) && licenses.length > 0) {
    return licenses
      .map((l) => (typeof l === "string" ? l : l?.type))
      .filter(Boolean)
      .join(" OR ");
  }
  return "UNKNOWN";
}

function readPackageJson(dir) {
  const pkgPath = path.join(dir, "package.json");
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    return null;
  }
}

function collectScopedOrPlain(nmDir) {
  const results = [];
  const entries = fs.readdirSync(nmDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name === ".bin" || entry.name === ".modules.yaml") continue;
    if (entry.name.startsWith("@")) {
      const scopeDir = path.join(nmDir, entry.name);
      let scoped;
      try {
        scoped = fs.readdirSync(scopeDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const child of scoped) {
        if (!child.isDirectory() && !child.isSymbolicLink()) continue;
        const pkgDir = path.join(scopeDir, child.name);
        const pkg = readPackageJson(pkgDir);
        if (pkg && typeof pkg.name === "string") results.push(pkg);
      }
    } else {
      const pkgDir = path.join(nmDir, entry.name);
      const pkg = readPackageJson(pkgDir);
      if (pkg && typeof pkg.name === "string") results.push(pkg);
    }
  }
  return results;
}

const pnpmEntries = fs.readdirSync(pnpmDir, { withFileTypes: true });
const resolved = [];
const seen = new Set();

for (const entry of pnpmEntries) {
  if (!entry.isDirectory()) continue;
  if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
  const nmDir = path.join(pnpmDir, entry.name, "node_modules");
  if (!fs.existsSync(nmDir)) continue;
  for (const pkg of collectScopedOrPlain(nmDir)) {
    const key = `${pkg.name}@${pkg.version ?? "?"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({
      name: pkg.name,
      version: String(pkg.version ?? "?"),
      license: normalizeLicense(pkg),
    });
  }
}

resolved.sort((a, b) => {
  if (a.name !== b.name) return a.name.localeCompare(b.name);
  return a.version.localeCompare(b.version);
});

const resolvedCount = resolved.length;

const licenseCountMap = new Map();
for (const item of resolved) {
  licenseCountMap.set(item.license, (licenseCountMap.get(item.license) ?? 0) + 1);
}

const licenseRows = Array.from(licenseCountMap.entries()).sort((a, b) => {
  if (b[1] !== a[1]) return b[1] - a[1];
  return a[0].localeCompare(b[0]);
});

const summaryLines = [
  `- Resolved package entries: ${resolvedCount}`,
  "- Generated from: `node_modules/.pnpm` (via `pnpm install`)",
  "",
  "| License expression | Package count |",
  "| --- | ---: |",
  ...licenseRows.map(([license, count]) => `| ${license} | ${count} |`),
];

const familyDefinitions = [
  {
    label: "`caniuse-lite`",
    match: (name) => name === "caniuse-lite",
  },
  {
    label: "`axe-core`",
    match: (name) => name === "axe-core",
  },
  {
    label: "`lightningcss` + platform binaries",
    match: (name) => name === "lightningcss" || name.startsWith("lightningcss-"),
  },
  {
    label: "`@img/sharp-libvips-*` platform binaries",
    match: (name) => name.startsWith("@img/sharp-libvips-"),
  },
  {
    label: "`@img/sharp-wasm32`",
    match: (name) => name === "@img/sharp-wasm32",
  },
];

const familyRows = familyDefinitions
  .map((family) => {
    const matches = resolved.filter((item) => family.match(item.name));
    if (matches.length === 0) return null;

    const versions = Array.from(new Set(matches.map((item) => item.version))).sort();
    const licenses = Array.from(new Set(matches.map((item) => item.license))).sort();

    return {
      label: family.label,
      versions: versions.join(", "),
      licenses: licenses.join(" / "),
    };
  })
  .filter(Boolean);

const noticeLines = [
  "| Package (family) | Version(s) in lockfile | License |",
  "| --- | --- | --- |",
  ...familyRows.map(
    (row) => `| ${row.label} | \`${row.versions}\` | \`${row.licenses}\` |`,
  ),
];

const markers = {
  summary: {
    start: "<!-- BEGIN_AUTOGEN:LICENSE_SUMMARY -->",
    end: "<!-- END_AUTOGEN:LICENSE_SUMMARY -->",
    content: summaryLines.join("\n"),
  },
  notice: {
    start: "<!-- BEGIN_AUTOGEN:NOTICE_RELEVANT -->",
    end: "<!-- END_AUTOGEN:NOTICE_RELEVANT -->",
    content: noticeLines.join("\n"),
  },
};

function updateBlock(doc, marker) {
  const section = `${marker.start}\n${marker.content}\n${marker.end}`;
  const startIndex = doc.indexOf(marker.start);
  const endIndex = doc.indexOf(marker.end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing or invalid marker block: ${marker.start} ... ${marker.end}`);
  }

  const endOffset = endIndex + marker.end.length;
  return doc.slice(0, startIndex) + section + doc.slice(endOffset);
}

const current = fs.readFileSync(noticesPath, "utf8");
let next = current;
next = updateBlock(next, markers.summary);
next = updateBlock(next, markers.notice);

if (mode === "--update") {
  if (next !== current) {
    fs.writeFileSync(noticesPath, next);
    console.log("Updated THIRD_PARTY_NOTICES.md");
  } else {
    console.log("THIRD_PARTY_NOTICES.md is already up to date");
  }
  process.exit(0);
}

if (next !== current) {
  console.error("THIRD_PARTY_NOTICES.md is out of date.");
  console.error("Run: pnpm notices:update");
  process.exit(1);
}

console.log("THIRD_PARTY_NOTICES.md is up to date");
