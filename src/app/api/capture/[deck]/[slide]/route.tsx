import { ImageResponse } from "next/og";
import { loadDeck } from "@/lib/deck-loader";
import { resolveSlideBackground } from "@/lib/slide-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "columns"; gap: string; children: ColumnBlock[] }
  | { type: "image"; alt: string }
  | { type: "placeholder"; label: string }
  | { type: "blockquote"; text: string }
  | { type: "code"; content: string };

interface ColumnBlock {
  width?: string;
  children: ContentBlock[];
}

interface Theme {
  bg: string;
  textColor: string;
  primaryColor: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deck: string; slide: string }> },
) {
  const { deck: deckName, slide: slideStr } = await params;
  const slideIndex = parseInt(slideStr, 10);

  if (isNaN(slideIndex) || slideIndex < 0) {
    return new Response("Invalid slide index", { status: 400 });
  }

  let deck;
  try {
    deck = await loadDeck(deckName);
  } catch {
    return new Response("Deck not found", { status: 404 });
  }

  const slide = deck.slides[slideIndex];
  if (!slide) {
    return new Response(
      `Slide ${slideIndex} not found (deck has ${deck.slides.length} slides)`,
      { status: 404 },
    );
  }

  const bg = resolveSlideBackground(slide.frontmatter, deck.config);
  const theme: Theme = {
    bg,
    textColor: deck.config.theme.colors.text || "#1a1a1a",
    primaryColor: deck.config.theme.colors.primary || "#000000",
  };

  let blocks: ContentBlock[];
  try {
    blocks = parseMdxContent(slide.rawContent);
  } catch (e) {
    return new Response(
      `Parse error: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 },
    );
  }

  try {
    return new ImageResponse(renderSlide(blocks, theme), {
      width: 1920,
      height: 1080,
    });
  } catch (e) {
    return new Response(
      `Render error: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Satori renderer
// ---------------------------------------------------------------------------

function renderSlide(
  blocks: ContentBlock[],
  theme: Theme,
): React.ReactElement {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        display: "flex",
        flexDirection: "column",
        background: theme.bg,
        padding: "80px 72px 64px",
        color: theme.textColor,
        fontFamily: "sans-serif",
        overflow: "hidden",
      }}
    >
      {blocks
        .map((block, i) => renderBlock(block, i, theme))
        .filter(Boolean)}
    </div>
  );
}

function renderBlock(
  block: ContentBlock,
  key: number,
  theme: Theme,
): React.ReactElement | null {
  switch (block.type) {
    case "heading": {
      const sizes: Record<number, number> = { 1: 64, 2: 48, 3: 36 };
      return (
        <div
          key={key}
          style={{
            display: "flex",
            marginBottom: 16,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: sizes[block.level] || 36,
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {block.text}
          </span>
        </div>
      );
    }

    case "paragraph":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 28, lineHeight: 1.5 }}>{block.text}</span>
        </div>
      );

    case "list":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: 12,
            paddingLeft: 32,
            flexShrink: 0,
          }}
        >
          {block.items.map((item, j) => (
            <div key={j} style={{ display: "flex", marginBottom: 6 }}>
              <span style={{ fontSize: 28, lineHeight: 1.5 }}>
                {block.ordered ? `${j + 1}. ` : "- "}
                {item}
              </span>
            </div>
          ))}
        </div>
      );

    case "columns":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            gap: gapToPx(block.gap),
            flex: 1,
          }}
        >
          {block.children.map((col, j) => {
            const colStyle: Record<string, unknown> = {
              display: "flex",
              flexDirection: "column",
            };
            if (col.width) {
              colStyle.width = col.width;
            } else {
              colStyle.flex = 1;
            }
            return (
              <div key={j} style={colStyle}>
                {col.children
                  .map((child, k) => renderBlock(child, k, theme))
                  .filter(Boolean)}
              </div>
            );
          })}
        </div>
      );

    case "image":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            minHeight: 100,
            border: "3px dashed #999",
            borderRadius: 12,
            background: "#f0f0f0",
            margin: "8px 0",
          }}
        >
          <span style={{ fontSize: 24, color: "#666" }}>
            [Image: {block.alt}]
          </span>
        </div>
      );

    case "placeholder":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            minHeight: 80,
            border: "2px dashed #aaa",
            borderRadius: 8,
            background: "#fafafa",
            margin: "8px 0",
          }}
        >
          <span style={{ fontSize: 22, color: "#888" }}>
            [{block.label}]
          </span>
        </div>
      );

    case "blockquote":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            borderLeft: `4px solid ${theme.primaryColor}`,
            paddingLeft: 24,
            margin: "12px 0",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 28, fontStyle: "italic", lineHeight: 1.5 }}>
            {block.text}
          </span>
        </div>
      );

    case "code":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#1e1e1e",
            borderRadius: 8,
            padding: 24,
            margin: "8px 0",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 20,
              color: "#d4d4d4",
              fontFamily: "monospace",
              lineHeight: 1.4,
            }}
          >
            {block.content.length > 300
              ? block.content.slice(0, 300) + "..."
              : block.content}
          </span>
        </div>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// MDX content parser
// ---------------------------------------------------------------------------

function parseMdxContent(raw: string): ContentBlock[] {
  const lines = raw.split("\n");
  return parseLineRange(lines, 0, lines.length);
}

/** Safe accessor — never returns undefined. */
function line(lines: string[], i: number): string {
  return lines[i] ?? "";
}

function parseLineRange(
  lines: string[],
  start: number,
  end: number,
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let i = start;

  while (i < end) {
    const trimmed = line(lines, i).trim();

    // Skip empty lines, frontmatter, imports, exports, JSX comments
    if (
      !trimmed ||
      trimmed === "---" ||
      trimmed === "***" ||
      trimmed === "___" ||
      trimmed.startsWith("import ") ||
      trimmed.startsWith("export ") ||
      trimmed.startsWith("{/*")
    ) {
      i++;
      continue;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      blocks.push({
        type: "heading",
        level: hMatch[1].length as 1 | 2 | 3,
        text: stripInline(hMatch[2]),
      });
      i++;
      continue;
    }

    // Code blocks
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < end && !line(lines, i).trim().startsWith("```")) {
        codeLines.push(line(lines, i));
        i++;
      }
      if (i < end) i++; // skip closing ```
      blocks.push({ type: "code", content: codeLines.join("\n") });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const qLines: string[] = [];
      while (i < end && line(lines, i).trim().startsWith(">")) {
        qLines.push(line(lines, i).trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", text: stripInline(qLines.join(" ")) });
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < end && /^[-*]\s/.test(line(lines, i).trim())) {
        items.push(stripInline(line(lines, i).trim().slice(2)));
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < end && /^\d+\.\s/.test(line(lines, i).trim())) {
        items.push(stripInline(line(lines, i).trim().replace(/^\d+\.\s/, "")));
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Image
    const imgMatch = trimmed.match(/!\[([^\]]*)\]\([^)]+\)/);
    if (imgMatch) {
      blocks.push({ type: "image", alt: imgMatch[1] || "Image" });
      i++;
      continue;
    }

    // Math block
    if (trimmed.startsWith("$$")) {
      i++;
      while (i < end && !line(lines, i).trim().endsWith("$$")) i++;
      if (i < end) i++;
      blocks.push({ type: "placeholder", label: "Math Formula" });
      continue;
    }

    // <Columns> block
    if (trimmed.startsWith("<Columns")) {
      const gapMatch = trimmed.match(/gap="([^"]+)"/);
      const gap = gapMatch?.[1] || "2rem";
      i++;
      let depth = 1;
      const innerStart = i;
      while (i < end) {
        if (line(lines, i).trim().startsWith("<Columns")) depth++;
        if (line(lines, i).trim().startsWith("</Columns>")) {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }
      const innerEnd = i;
      if (i < end) i++; // skip </Columns>
      blocks.push({
        type: "columns",
        gap,
        children: parseColumnChildren(lines, innerStart, innerEnd),
      });
      continue;
    }

    // Closing tags — skip
    if (trimmed.startsWith("</")) {
      i++;
      continue;
    }

    // JSX components (uppercase tag name)
    if (/^<[A-Z]/.test(trimmed)) {
      const tagMatch = trimmed.match(/^<(\w+)/);
      const tag = tagMatch?.[1] || "Component";

      // Self-closing on same line
      if (trimmed.includes("/>")) {
        blocks.push({ type: "placeholder", label: labelFor(tag, trimmed) });
        i++;
        continue;
      }

      // Multi-line tag — consume until /> or >
      if (!trimmed.endsWith(">")) {
        let full = trimmed;
        i++;
        while (i < end) {
          const l = line(lines, i).trim();
          full += " " + l;
          if (l.includes("/>")) {
            blocks.push({ type: "placeholder", label: labelFor(tag, full) });
            i++;
            break;
          }
          if (l.endsWith(">")) {
            i++;
            break;
          }
          i++;
        }
        continue;
      }

      // Opening tag closed on same line — skip, children processed naturally
      i++;
      continue;
    }

    // Generic HTML tags, JSX expressions — skip
    if (trimmed.startsWith("<") || trimmed.startsWith("{")) {
      i++;
      continue;
    }

    // Paragraph (default for text content)
    if (trimmed) {
      const textLines: string[] = [];
      while (i < end) {
        const l = line(lines, i).trim();
        if (
          !l ||
          l.startsWith("#") ||
          l.startsWith("<") ||
          l.startsWith("```") ||
          l.startsWith(">") ||
          /^[-*]\s/.test(l) ||
          /^\d+\.\s/.test(l) ||
          l.startsWith("$$") ||
          l.startsWith("{") ||
          l.startsWith("!")
        ) {
          break;
        }
        textLines.push(stripInline(l));
        i++;
      }
      if (textLines.length > 0) {
        blocks.push({ type: "paragraph", text: textLines.join(" ") });
      }
      continue;
    }

    i++;
  }

  return blocks;
}

function parseColumnChildren(
  lines: string[],
  start: number,
  end: number,
): ColumnBlock[] {
  const columns: ColumnBlock[] = [];
  let i = start;

  while (i < end) {
    const trimmed = line(lines, i).trim();

    // Match <Column> or <Column width="..."> but NOT <Columns>
    if (/^<Column[\s>]/.test(trimmed) && !trimmed.startsWith("<Columns")) {
      const widthMatch = trimmed.match(/width="([^"]+)"/);
      const width = widthMatch?.[1];
      const innerStart = i + 1;

      // Find closing </Column> with depth tracking for nested Columns
      i++;
      let nestedDepth = 0;
      while (i < end) {
        const l = line(lines, i).trim();
        if (l.startsWith("<Columns")) nestedDepth++;
        if (l.startsWith("</Columns>")) nestedDepth--;
        if (l === "</Column>" && nestedDepth === 0) break;
        i++;
      }
      const innerEnd = i;
      if (i < end) i++; // skip </Column>

      columns.push({
        width,
        children: parseLineRange(lines, innerStart, innerEnd),
      });
      continue;
    }

    i++;
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function stripInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");
}

function labelFor(tag: string, fullTag: string): string {
  switch (tag) {
    case "Chart": {
      const m = fullTag.match(/type="([^"]+)"/);
      return `Chart (${m?.[1] || "bar"})`;
    }
    case "Icon": {
      const m = fullTag.match(/name="([^"]+)"/);
      return `Icon: ${m?.[1] || "icon"}`;
    }
    case "Shape": {
      const m = fullTag.match(/type="([^"]+)"/);
      return `Shape: ${m?.[1] || "shape"}`;
    }
    case "Video":
      return "Video Player";
    case "Fragment":
      return "Fragment";
    default:
      return tag;
  }
}

function gapToPx(gap: string): number {
  const match = gap.match(/^(\d+(?:\.\d+)?)\s*(rem|px|em)?$/);
  if (!match) return 32;
  const value = parseFloat(match[1]);
  const unit = match[2] || "rem";
  if (unit === "px") return value;
  return value * 16; // rem/em → px
}
