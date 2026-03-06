import fs from "node:fs/promises";
import matter from "gray-matter";
import {
  isHardValidationIssue,
  parseLogicalSlideInput,
  validateLogicalSlideInput,
  type LogicalSlideInput,
} from "@/lib/strict-schema";
import type {
  AuthoringMode,
  SlideData,
  SlideType,
} from "@/types/deck";

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

function isSlideType(value: unknown): value is SlideType {
  return typeof value === "string" && VALID_SLIDE_TYPES.has(value);
}

export async function processSlideFile(
  filePath: string,
  index: number,
  filename: string,
  authoringMode: AuthoringMode = "free",
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
  const frontmatter = data as Record<string, unknown>;

  const type: SlideType =
    isSlideType(frontmatter.type)
      ? frontmatter.type
      : "content";

  const fit =
    frontmatter.fit === "strict" || frontmatter.fit === "free"
      ? frontmatter.fit
      : undefined;

  const strictMode = authoringMode === "strict" || fit === "strict";

  let strictInput: LogicalSlideInput | undefined;
  if (strictMode) {
    if (content.trim().length > 0) {
      throw new Error(
        `Strict slide "${filename}" must not include MDX body content. Use frontmatter slots only.`,
      );
    }

    strictInput = parseLogicalSlideInput(frontmatter);
    const issues = validateLogicalSlideInput(strictInput);
    const hardIssues = issues.filter(isHardValidationIssue);
    if (hardIssues.length > 0) {
      throw new Error(
        `Strict slide "${filename}" is invalid:\n${issues
          .map((issue) => `- ${issue.path}: ${issue.message}`)
          .join("\n")}`,
      );
    }
  }

  return {
    index,
    filename,
    frontmatter: {
      type,
      transition:
        frontmatter.transition === "fade"
        || frontmatter.transition === "slide"
        || frontmatter.transition === "none"
          ? frontmatter.transition
          : undefined,
      notes: typeof frontmatter.notes === "string" ? frontmatter.notes : undefined,
      background: typeof frontmatter.background === "string" ? frontmatter.background : undefined,
      verticalAlign:
        frontmatter.verticalAlign === "top" || frontmatter.verticalAlign === "center"
          ? frontmatter.verticalAlign
          : undefined,
      fit,
      layout: strictInput?.layout,
      variantId: strictInput?.variantId,
    },
    rawContent: content,
    notes: typeof frontmatter.notes === "string" ? frontmatter.notes : undefined,
    strictInput,
  };
}
