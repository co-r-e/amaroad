import path from "node:path";

export function normalizeSlideOrderEntries(
  entries: unknown[],
  deckName: string,
): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== "string") {
      console.warn(
        `[amaroad] ${deckName}/slide-order.ts has non-string entry at index ${index}`,
      );
      continue;
    }

    const raw = entry.trim();
    if (!raw) {
      console.warn(
        `[amaroad] ${deckName}/slide-order.ts has empty entry at index ${index}`,
      );
      continue;
    }

    if (path.isAbsolute(raw) || raw.includes("/") || raw.includes("\\")) {
      console.warn(
        `[amaroad] ${deckName}/slide-order.ts has invalid path-like entry at index ${index}: ${raw}`,
      );
      continue;
    }

    const ext = path.extname(raw);
    if (ext && ext !== ".mdx") {
      console.warn(
        `[amaroad] ${deckName}/slide-order.ts has unsupported extension at index ${index}: ${raw}`,
      );
      continue;
    }

    const filename = ext === ".mdx" ? raw : `${raw}.mdx`;
    if (seen.has(filename)) {
      console.warn(
        `[amaroad] ${deckName}/slide-order.ts has duplicate entry: ${filename}`,
      );
      continue;
    }

    seen.add(filename);
    normalized.push(filename);
  }

  return normalized;
}
