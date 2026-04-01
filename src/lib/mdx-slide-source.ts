function scaleCssLengthTokens(value: string, scaleVar: string): string {
  return value.replace(
    /(-?\d*\.?\d+)(rem|px)\b/g,
    (_, amount: string, unit: string) => `calc(${amount}${unit} * var(${scaleVar}))`,
  );
}

export function resolveAssetPaths(rawContent: string, deckName: string): string {
  const apiBase = `/api/decks/${encodeURIComponent(deckName)}/assets/`;
  return rawContent
    .replace(/\(\.\/assets\//g, `(${apiBase}`)
    .replace(/"\.\/assets\//g, `"${apiBase}`)
    .replace(/'\.\/assets\//g, `'${apiBase}`);
}

export function normalizeMdxSizing(rawContent: string): string {
  const inlineFontSizePattern =
    /(fontSize\s*:\s*)(["'])(-?\d*\.?\d+)(rem|px)\2/g;
  const svgFontSizePattern =
    /(fontSize\s*=\s*)(["'])(-?\d*\.?\d+)(px|rem)?\2/g;
  const spacingPropertyPattern =
    /((?:margin|marginTop|marginBottom|marginLeft|marginRight|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|gap|rowGap|columnGap)\s*:\s*)(["'])([^"']*?\d[^"']*)\2/g;
  const fencedCodePattern = /(```[\s\S]*?```)/g;

  const normalizeSegment = (segment: string): string =>
    segment
      .replace(
        inlineFontSizePattern,
        (_, prefix: string, quote: string, amount: string, unit: string) =>
          `${prefix}${quote}calc(${amount}${unit} * var(--slide-font-scale))${quote}`,
      )
      .replace(
        svgFontSizePattern,
        (_, prefix: string, quote: string, amount: string, unit?: string) =>
          `${prefix}${quote}calc(${amount}${unit ?? "px"} * var(--slide-font-scale))${quote}`,
      )
      .replace(
        spacingPropertyPattern,
        (_, prefix: string, quote: string, value: string) =>
          `${prefix}${quote}${scaleCssLengthTokens(value, "--slide-space-scale")}${quote}`,
      );

  return rawContent
    .split(fencedCodePattern)
    .map((segment) => (segment.startsWith("```") ? segment : normalizeSegment(segment)))
    .join("");
}

export function processSlideSource(rawContent: string, deckName: string): string {
  return normalizeMdxSizing(resolveAssetPaths(rawContent, deckName));
}

export function hashSlideSource(value: string): string {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}
