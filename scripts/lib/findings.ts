/**
 * Shared finding model and renderers for `pnpm amaroad doctor|overflow`.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export type Severity = "error" | "warning" | "info";

export interface Finding {
  deck: string;
  /** Which check produced it: config, preflight, manifest, assets, fonts, overflow. */
  check: string;
  rule: string;
  severity: Severity;
  message: string;
  /** Repo-relative path, e.g. `decks/sample-deck/cover.mdx`. */
  file?: string;
  line?: number;
  column?: number;
  snippet?: string;
  meta?: Record<string, unknown>;
}

export interface FindingsSummary {
  errors: number;
  warnings: number;
  infos: number;
  total: number;
  byCheck: Record<string, { errors: number; warnings: number; infos: number }>;
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function summarize(findings: Finding[]): FindingsSummary {
  const summary: FindingsSummary = { errors: 0, warnings: 0, infos: 0, total: findings.length, byCheck: {} };
  for (const f of findings) {
    const bucket = (summary.byCheck[f.check] ??= { errors: 0, warnings: 0, infos: 0 });
    if (f.severity === "error") {
      summary.errors++;
      bucket.errors++;
    } else if (f.severity === "warning") {
      summary.warnings++;
      bucket.warnings++;
    } else {
      summary.infos++;
      bucket.infos++;
    }
  }
  return summary;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (r !== 0) return r;
    const f = (a.file ?? "").localeCompare(b.file ?? "");
    if (f !== 0) return f;
    const l = (a.line ?? 0) - (b.line ?? 0);
    if (l !== 0) return l;
    return a.rule.localeCompare(b.rule);
  });
}

export function shouldFail(summary: FindingsSummary, failOn: "error" | "warning" | "never"): boolean {
  if (failOn === "never") return false;
  if (summary.errors > 0) return true;
  return failOn === "warning" && summary.warnings > 0;
}

export interface RenderOptions {
  title: string;
  decks: string[];
  checks?: string[];
  skipped?: string[];
  notes?: string[];
}

export function renderMarkdown(findings: Finding[], options: RenderOptions): string {
  const summary = summarize(findings);
  const lines: string[] = [];
  lines.push(`# ${options.title}`, "");
  lines.push(`- decks: ${options.decks.join(", ") || "(none)"}`);
  if (options.checks?.length) lines.push(`- checks: ${options.checks.join(", ")}`);
  if (options.skipped?.length) lines.push(`- skipped: ${options.skipped.join(", ")}`);
  lines.push(`- errors: ${summary.errors}`);
  lines.push(`- warnings: ${summary.warnings}`);
  lines.push(`- info: ${summary.infos}`);
  for (const note of options.notes ?? []) lines.push(`- note: ${note}`);
  lines.push("");

  const byCheck = Object.entries(summary.byCheck);
  if (byCheck.length > 0) {
    lines.push("| check | errors | warnings | info |", "|---|---:|---:|---:|");
    for (const [check, counts] of byCheck.sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`| ${check} | ${counts.errors} | ${counts.warnings} | ${counts.infos} |`);
    }
    lines.push("");
  }

  if (findings.length === 0) {
    lines.push("No issues found.");
    return lines.join("\n");
  }

  const groups = new Map<string, Finding[]>();
  for (const f of sortFindings(findings)) {
    const key = f.file ?? `decks/${f.deck}`;
    const list = groups.get(key) ?? [];
    list.push(f);
    groups.set(key, list);
  }

  for (const [file, list] of groups) {
    lines.push(`## ${file}`);
    for (const f of list) {
      const where = f.line !== undefined ? `L${f.line}${f.column !== undefined ? `:C${f.column}` : ""} ` : "";
      lines.push(`- [${f.severity}] ${where}${f.check}/${f.rule} - ${f.message}`);
      if (f.snippet) lines.push(`  \`${f.snippet.replace(/`/g, "'")}\``);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function renderJson(findings: Finding[], options: RenderOptions): string {
  const summary = summarize(findings);
  return JSON.stringify(
    {
      title: options.title,
      decks: options.decks,
      checks: options.checks ?? [],
      skipped: options.skipped ?? [],
      summary,
      findings: sortFindings(findings),
    },
    null,
    2,
  );
}

/**
 * Print the report to stdout, or write it to `outputPath` when given.
 * pnpm 11 prints install-verification lines to stdout before `pnpm run`
 * scripts, so machine consumers should prefer `--output` (or `pnpm --silent`).
 */
export function emitReport(report: string, outputPath?: string): void {
  if (!outputPath) {
    process.stdout.write(report + "\n");
    return;
  }
  const absolute = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, report + "\n", "utf-8");
  process.stderr.write(`Report written to ${absolute}\n`);
}
