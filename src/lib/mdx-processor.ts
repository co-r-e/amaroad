import matter from "gray-matter";
import type { SlideFrontmatter, SlideData, SlideType } from "@/types/deck";
import fs from "./runtime-fs";

const VALID_SLIDE_TYPES: Set<string> = new Set<SlideType>([
  "cover",
  "section",
  "content",
  "comparison",
  "stats",
  "timeline",
  "image-left",
  "image-right",
  "image-full",
  "quote",
  "agenda",
  "ending",
]);

export async function processSlideFile(
  filePath: string,
  index: number,
  filename: string,
): Promise<SlideData> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (e) {
    throw new Error(
      `Failed to read slide file: ${filePath}\n${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const { data, content } = matter(raw);
  const frontmatter = data as Partial<SlideFrontmatter>;
  const contentStartLine = computeContentStartLine(raw, content);

  const type: SlideType =
    frontmatter.type && VALID_SLIDE_TYPES.has(frontmatter.type)
      ? frontmatter.type
      : "content";

  return {
    index,
    filename,
    frontmatter: {
      type,
      transition: frontmatter.transition,
      notes: frontmatter.notes,
      background: frontmatter.background,
      verticalAlign: frontmatter.verticalAlign as SlideFrontmatter["verticalAlign"],
      logo: frontmatter.logo,
    },
    rawContent: content,
    notes: frontmatter.notes,
    contentStartLine,
  };
}

/**
 * gray-matter strips the frontmatter block (and the newline after the closing
 * `---`). Count how many lines of the original file precede the body so line
 * numbers reported against `content` can be converted to file lines.
 */
function computeContentStartLine(raw: string, content: string): number {
  if (!content) return countLines(raw) + 1;
  const bodyStart = raw.lastIndexOf(content);
  if (bodyStart <= 0) return 1;
  return countLines(raw.slice(0, bodyStart)) + 1;
}

function countLines(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}
