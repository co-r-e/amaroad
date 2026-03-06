import fs from "node:fs/promises";
import matter from "gray-matter";
import type { SlideFrontmatter, SlideData, SlideType } from "@/types/deck";

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
    },
    rawContent: content,
    notes: frontmatter.notes,
  };
}
