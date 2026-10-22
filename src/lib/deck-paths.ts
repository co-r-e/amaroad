export function isUnsafeDeckName(name: string): boolean {
  return !name || name.includes("\0") || name.includes("/") || name.includes("\\") ||
    name.includes("..") || name.startsWith("_") || name.startsWith(".");
}
