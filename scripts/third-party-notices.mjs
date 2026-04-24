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
const lockfilePath = path.join(rootDir, "pnpm-lock.yaml");
const noticesPath = path.join(rootDir, "THIRD_PARTY_NOTICES.md");

if (!fs.existsSync(pnpmDir)) {
  console.error(
    "node_modules/.pnpm not found. Run `pnpm install` before running notices.",
  );
  process.exit(1);
}

if (!fs.existsSync(lockfilePath)) {
  console.error("pnpm-lock.yaml not found. Run `pnpm install` first.");
  process.exit(1);
}

// Minimal parser for pnpm-lock.yaml's `packages:` section. We only need each
// package's name/version plus any declared `cpu`/`os` markers to decide
// whether the package is an optional platform-specific binary — the full
// YAML surface area would be overkill here.
function parseLockfilePlatformPackages(text) {
  const lines = text.split("\n");
  const startIndex = lines.findIndex((line) => line === "packages:");
  if (startIndex === -1) return [];
  const packages = [];
  let current = null;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length === 0) continue;
    // A top-level sibling section ends the packages block.
    if (/^[^\s]/.test(line)) break;
    const pkgHeader = line.match(/^ {2}(?:'([^']+)'|([^\s:]+)):\s*$/);
    if (pkgHeader) {
      const key = pkgHeader[1] ?? pkgHeader[2];
      const atIndex = key.lastIndexOf("@");
      const name = atIndex > 0 ? key.slice(0, atIndex) : key;
      const version = atIndex > 0 ? key.slice(atIndex + 1) : "";
      current = { name, version, cpu: null, os: null };
      packages.push(current);
      continue;
    }
    if (!current) continue;
    const cpuMatch = line.match(/^ {4}cpu:\s*\[([^\]]*)\]/);
    if (cpuMatch) {
      current.cpu = cpuMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    const osMatch = line.match(/^ {4}os:\s*\[([^\]]*)\]/);
    if (osMatch) {
      current.os = osMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
  }
  return packages;
}

const lockfilePackages = parseLockfilePlatformPackages(
  fs.readFileSync(lockfilePath, "utf8"),
);
const platformBinaryKeys = new Set(
  lockfilePackages
    .filter((p) => p.cpu || p.os)
    .map((p) => `${p.name}@${p.version}`),
);

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
      isPlatformBinary: platformBinaryKeys.has(key),
    });
  }
}

resolved.sort((a, b) => {
  if (a.name !== b.name) return a.name.localeCompare(b.name);
  return a.version.localeCompare(b.version);
});

// A package with declared `cpu` or `os` is an optional platform-specific
// binary. pnpm only installs variants that match the current host, so
// counting them directly would make THIRD_PARTY_NOTICES.md diverge between
// macOS/Linux/Windows developers. Collapse every variant into a single
// family entry keyed by the base package name with the platform/arch/libc
// suffix replaced by `*`.
//
// The suffix is derived from the package's own `cpu` / `os` declarations
// plus a small set of libc markers that commonly appear in names but not
// in the os array (e.g. `gnu`, `musl`, `linuxmusl`).
// Trailing ABI / libc markers that appear in platform-binary package names
// but never in the `os` / `cpu` arrays the package declares in its own
// package.json. Strip them so family grouping works across libraries that
// follow different naming conventions (musl vs gnu vs msvc, etc.).
const LIBC_TOKENS = [
  "gnu",
  "gnueabi",
  "gnueabihf",
  "musl",
  "musleabihf",
  "eabi",
  "androideabi",
  "msvc",
  "wasi",
  "linuxmusl",
];

function platformFamilyLabel(pkg) {
  const tokens = new Set();
  for (const value of pkg.cpu ?? []) tokens.add(value.toLowerCase());
  for (const value of pkg.os ?? []) tokens.add(value.toLowerCase());
  for (const value of LIBC_TOKENS) tokens.add(value);

  let trimmed = pkg.name;
  let trailingDelim = null;
  while (true) {
    const match = trimmed.match(/^(.+?)([/-])([A-Za-z0-9]+)$/);
    if (!match) break;
    if (!tokens.has(match[3].toLowerCase())) break;
    trimmed = match[1];
    trailingDelim = match[2];
  }

  if (trailingDelim === null) {
    // Package has os/cpu but the name carries no platform suffix (e.g.
    // `fsevents` is darwin-only). Treat it as a single-member family.
    return pkg.name;
  }
  return `${trimmed}${trailingDelim}*`;
}

const crossPlatform = resolved.filter((item) => !item.isPlatformBinary);

// Platform family membership is driven by the lockfile so the output is
// identical regardless of which OS ran `pnpm install`. Licenses come from
// whichever host variant happens to be installed locally — variants in the
// same family share a license by convention (e.g. every `@esbuild/*` is MIT).
const platformFamilies = new Map();
for (const pkg of lockfilePackages) {
  if (!pkg.cpu && !pkg.os) continue;
  const label = platformFamilyLabel(pkg);
  const family = platformFamilies.get(label) ?? {
    label,
    versions: new Set(),
    licenses: new Set(),
  };
  family.versions.add(pkg.version);
  platformFamilies.set(label, family);
}

// Index of installed platform-binary licenses, keyed by name@version. We
// need this to fill in the family license field using whichever variant
// happens to be installed on the host OS.
const installedByKey = new Map();
for (const item of resolved) {
  if (!item.isPlatformBinary) continue;
  installedByKey.set(`${item.name}@${item.version}`, item.license);
}

for (const pkg of lockfilePackages) {
  if (!pkg.cpu && !pkg.os) continue;
  const license = installedByKey.get(`${pkg.name}@${pkg.version}`);
  if (!license) continue;
  const family = platformFamilies.get(platformFamilyLabel(pkg));
  if (family) family.licenses.add(license);
}

// For families whose host variant isn't installed on the current OS
// (e.g. `fsevents` when running on Linux), fall back to a known license
// so the table stays identical across platforms. Keep this map tight and
// audited; a missing entry surfaces as an explicit error rather than a
// silent UNKNOWN.
const PLATFORM_FAMILY_LICENSE_FALLBACKS = {
  fsevents: "MIT",
};

for (const family of platformFamilies.values()) {
  if (family.licenses.size > 0) continue;
  const fallback = PLATFORM_FAMILY_LICENSE_FALLBACKS[family.label];
  if (!fallback) {
    throw new Error(
      `No installed variant found for platform family "${family.label}" and no fallback license is registered. Add an entry to PLATFORM_FAMILY_LICENSE_FALLBACKS.`,
    );
  }
  family.licenses.add(fallback);
}

// Pull in cross-platform companion packages whose license or copyleft status
// is noteworthy when distributing artifacts. Matched by exact name so a
// rename surfaces here instead of silently dropping.
const COMPANION_PACKAGES = [
  "caniuse-lite",
  "axe-core",
  "lightningcss",
  "sharp",
];

const companionRows = COMPANION_PACKAGES.map((name) => {
  const matches = crossPlatform.filter((item) => item.name === name);
  if (matches.length === 0) return null;
  const versions = Array.from(new Set(matches.map((m) => m.version))).sort();
  const licenses = Array.from(new Set(matches.map((m) => m.license))).sort();
  return {
    label: `\`${name}\``,
    versions: versions.join(", "),
    licenses: licenses.join(" / "),
  };
}).filter(Boolean);

const platformFamilyRows = Array.from(platformFamilies.values())
  .sort((a, b) => a.label.localeCompare(b.label))
  .map((family) => ({
    label: `\`${family.label}\` platform binaries`,
    versions: Array.from(family.versions).sort().join(", "),
    licenses: Array.from(family.licenses).sort().join(" / "),
  }));

const noticeRelevantRows = [...companionRows, ...platformFamilyRows];

const licenseCountMap = new Map();
for (const item of crossPlatform) {
  licenseCountMap.set(item.license, (licenseCountMap.get(item.license) ?? 0) + 1);
}

const licenseRows = Array.from(licenseCountMap.entries()).sort((a, b) => {
  if (b[1] !== a[1]) return b[1] - a[1];
  return a[0].localeCompare(b[0]);
});

const summaryLines = [
  `- Cross-platform package entries: ${crossPlatform.length}`,
  `- Platform-specific binary families: ${platformFamilies.size}`,
  "- Generated from: `node_modules/.pnpm` (via `pnpm install`)",
  "- Counts exclude platform-optional binaries, which are grouped by family in the Notice-Relevant table below.",
  "",
  "| License expression | Package count |",
  "| --- | ---: |",
  ...licenseRows.map(([license, count]) => `| ${license} | ${count} |`),
];

const noticeLines = [
  "| Package (family) | Version(s) in lockfile | License |",
  "| --- | --- | --- |",
  ...noticeRelevantRows.map(
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
