import matter from "gray-matter";

/**
 * 1-based line of a top-level key inside a slide's `---` frontmatter block,
 * or undefined when the block or key is absent. Used to point findings at
 * the right line without re-parsing YAML.
 */
export function findFrontmatterKeyLine(raw: string, key: string): number | undefined {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return undefined;
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") return undefined;
    if (pattern.test(lines[i])) return i + 1;
  }
  return undefined;
}

/**
 * Why a slide's `narration` value cannot be used as a script, or null when it
 * is text or absent. YAML turns bare values like `123` or `2026-09-25` into a
 * number or Date, which the loader drops silently.
 */
export function nonTextNarrationProblem(raw: string): string | null {
  let value: unknown;
  try {
    value = matter(raw).data.narration;
  } catch {
    return null; // unparseable frontmatter is reported elsewhere
  }
  if (value === undefined || value === null || typeof value === "string") return null;
  const kind = value instanceof Date ? "a date" : Array.isArray(value) ? "a list" : typeof value;
  return `narration must be text (got ${kind}); quote it or use a block scalar (narration: |)`;
}
