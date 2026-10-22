/** Static references used by the HTML import command and doctor. */
export function richAssetReferences(html: string): string[] {
  const references = new Set<string>();
  const add = (value: string) => {
    const reference = value.trim();
    if (reference && !/^(?:data:|blob:|#)/i.test(reference)) references.add(reference);
  };
  for (const tag of html.matchAll(/<(?:img|script|source|video|audio|link)\b[^>]*>/gi)) {
    for (const attribute of tag[0].matchAll(/\b(?:src|poster|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)) {
      add(attribute[1] ?? attribute[2] ?? attribute[3]);
    }
  }
  for (const url of html.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) add(url[1] ?? url[2] ?? url[3]);
  for (const cssImport of html.matchAll(/@import\s+["']([^"']+)["']/gi)) add(cssImport[1]);
  return [...references];
}
