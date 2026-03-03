#!/usr/bin/env npx tsx
/**
 * deck-scaffold-from-brief: Create a new deck scaffold from a short brief.
 *
 * Usage:
 *   npx tsx .claude/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \
 *     --deck <deck-name> \
 *     --title "<deck title>" \
 *     --brief "<short brief>" \
 *     [--slides 10] \
 *     [--lang ja|en] \
 *     [--overwrite] \
 *     [--copyright "<copyright text>"]
 */

import * as fs from "node:fs";
import * as path from "node:path";

type Lang = "ja" | "en";

interface Args {
  deck: string;
  title: string;
  brief: string;
  slides: number;
  lang: Lang;
  overwrite: boolean;
  copyright?: string;
}

interface MiddleSlide {
  kind: "section" | "content";
  title: string;
  bullets: string[];
}

const USAGE = `
Usage:
  npx tsx .claude/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \\
    --deck <deck-name> --title "<deck title>" --brief "<brief>"

Required:
  --deck       Deck directory name (created under decks/)
  --title      Deck title
  --brief      Source brief text

Optional:
  --slides     Number of slides to generate (default: 10, minimum: 4)
  --lang       ja | en (default: ja)
  --overwrite  Overwrite an existing decks/<deck> directory
  --copyright  Copyright text written to deck.config.ts
  --help       Show this help
`.trim();

function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);

  let deck: string | undefined;
  let title: string | undefined;
  let brief: string | undefined;
  let slides = 10;
  let lang: Lang = "ja";
  let overwrite = false;
  let copyright: string | undefined;

  function needValue(flag: string, index: number): string {
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      fail(`${flag} requires a value`);
    }
    return next;
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    switch (token) {
      case "--help":
        process.stdout.write(USAGE + "\n");
        process.exit(0);
      case "--deck":
        deck = needValue("--deck", i);
        i++;
        break;
      case "--title":
        title = needValue("--title", i);
        i++;
        break;
      case "--brief":
        brief = needValue("--brief", i);
        i++;
        break;
      case "--slides": {
        const raw = needValue("--slides", i);
        i++;
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isInteger(parsed) || parsed < 4) {
          fail("--slides must be an integer >= 4");
        }
        slides = parsed;
        break;
      }
      case "--lang": {
        const raw = needValue("--lang", i);
        i++;
        if (raw !== "ja" && raw !== "en") {
          fail("--lang must be either 'ja' or 'en'");
        }
        lang = raw;
        break;
      }
      case "--overwrite":
        overwrite = true;
        break;
      case "--copyright":
        copyright = needValue("--copyright", i);
        i++;
        break;
      default:
        if (token.startsWith("--")) {
          fail(`Unknown option: ${token}`);
        }
        fail(`Unexpected argument: ${token}`);
    }
  }

  if (!deck || deck.trim().length === 0) fail("--deck is required");
  if (!title || title.trim().length === 0) fail("--title is required");
  if (!brief || brief.trim().length === 0) fail("--brief is required");

  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(deck)) {
    fail("--deck must match /^[a-z0-9][a-z0-9_-]*$/i");
  }
  if (deck.includes("/") || deck.includes("\\") || deck.includes("..")) {
    fail("--deck cannot contain path separators or '..'");
  }

  return {
    deck: deck.trim(),
    title: title.trim(),
    brief: brief.trim(),
    slides,
    lang,
    overwrite,
    copyright: copyright?.trim() || undefined,
  };
}

function findProjectRoot(): string {
  const starts = [process.cwd(), path.resolve(__dirname, "..", "..", "..", "..")];

  for (const start of starts) {
    let current = path.resolve(start);
    for (let i = 0; i < 12; i++) {
      const hasDecks = fs.existsSync(path.join(current, "decks"));
      const hasSrc = fs.existsSync(path.join(current, "src"));
      const hasPackageJson = fs.existsSync(path.join(current, "package.json"));
      if (hasDecks && hasSrc && hasPackageJson) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  fail("Could not find project root (expected decks/, src/, package.json)");
}

function escapeTsString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function cleanLine(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[{}]/g, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim();
}

function extractPoints(brief: string): string[] {
  const chunks = brief
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/[.!?;]+/))
    .map((line) => cleanLine(line))
    .filter((line) => line.length > 0);

  if (chunks.length === 0) {
    return ["Define goals", "Assess current state", "Plan next actions"];
  }

  return chunks.slice(0, 18);
}

function pickPoint(points: string[], index: number, fallback: string): string {
  return points[index] ?? fallback;
}

function createMiddleSlides(slides: number, lang: Lang, points: string[]): MiddleSlide[] {
  const middleCount = slides - 2;
  const sectionPositions = new Set<number>([0]);

  for (let pos = 3; pos < middleCount; pos += 4) {
    if (pos < middleCount - 1) {
      sectionPositions.add(pos);
    }
  }

  const result: MiddleSlide[] = [];
  let sectionNo = 1;
  let contentNo = 1;

  for (let pos = 0; pos < middleCount; pos++) {
    const pointA = pickPoint(
      points,
      pos * 2,
      `Key theme ${pos + 1}`,
    );
    const pointB = pickPoint(
      points,
      pos * 2 + 1,
      `Supporting point ${pos + 1}`,
    );

    if (sectionPositions.has(pos)) {
      const sectionTitle = `Section ${sectionNo}: ${pointA}`;

      result.push({
        kind: "section",
        title: cleanLine(sectionTitle),
        bullets: [cleanLine(pointA), cleanLine(pointB)],
      });
      sectionNo++;
    } else {
      const contentTitle = `Topic ${contentNo}: ${pointA}`;

      const pointC = pickPoint(
        points,
        pos * 2 + 2,
        "Add examples and data",
      );

      result.push({
        kind: "content",
        title: cleanLine(contentTitle),
        bullets: [cleanLine(pointA), cleanLine(pointB), cleanLine(pointC)],
      });
      contentNo++;
    }
  }

  const hasSection = result.some((s) => s.kind === "section");
  const hasContent = result.some((s) => s.kind === "content");
  if (!hasSection || !hasContent) {
    fail("Unable to compose both section and content slides; increase --slides");
  }

  return result;
}

function buildDeckConfig(args: Args): string {
  const year = new Date().getFullYear();
  const copyrightText =
    args.copyright ??
    (args.lang === "ja"
      ? `© ${year} ${args.title}`
      : `© ${year} ${args.title}`);

  const headingFont =
    args.lang === "ja" ? "Noto Sans JP, sans-serif" : "Inter, sans-serif";
  const bodyFont =
    args.lang === "ja" ? "Noto Sans JP, sans-serif" : "Inter, sans-serif";

  return `import { defineConfig } from "../../src/lib/deck-config";

export default defineConfig({
  title: "${escapeTsString(args.title)}",
  copyright: {
    text: "${escapeTsString(copyrightText)}",
    position: "bottom-left",
  },
  pageNumber: {
    position: "bottom-right",
    hideOnCover: true,
  },
  theme: {
    colors: {
      primary: "#0F172A",
      secondary: "#1E293B",
      accent: "#0EA5E9",
      background: "#FFFFFF",
      text: "#0F172A",
    },
    fonts: {
      heading: "${escapeTsString(headingFont)}",
      body: "${escapeTsString(bodyFont)}",
    },
  },
  transition: "fade",
});
`;
}

function buildCoverSlide(args: Args, points: string[]): string {
  const subtitle = "Deck scaffold generated from brief";
  const hint = "Use the following slides to fill in concrete details.";
  const summary = cleanLine(points[0] ?? args.brief);

  return `---
type: cover
transition: fade
notes: |
  Auto-generated cover slide from brief.
---

# ${cleanLine(args.title)}

${subtitle}

${summary}

${hint}
`;
}

function buildSectionSlide(
  title: string,
  bullets: string[],
  sectionNo: number,
): string {
  const notes = `Section ${sectionNo} divider.`;

  const line1 = cleanLine(bullets[0] ?? "Clarify the goal");
  const line2 = cleanLine(
    bullets[1] ?? "Detail in following slides",
  );

  return `---
type: section
transition: fade
notes: |
  ${notes}
---

# ${cleanLine(title)}

${line1}

${line2}
`;
}

function buildContentSlide(
  title: string,
  bullets: string[],
  contentNo: number,
): string {
  const notes =
    `Draft for topic ${contentNo}. Add charts, examples, and evidence as needed.`;

  const b1 = cleanLine(
    bullets[0] ?? "Frame background and problem",
  );
  const b2 = cleanLine(
    bullets[1] ?? "Present approach",
  );
  const b3 = cleanLine(
    bullets[2] ?? "Clarify outcomes and next actions",
  );

  return `---
type: content
transition: fade
notes: |
  ${notes}
---

# ${cleanLine(title)}

- ${b1}
- ${b2}
- ${b3}
`;
}

function buildEndingSlide(): string {
  const heading = "Thank You";
  const body =
    "Use this scaffold as a base, then add concrete data, visuals, and examples.";
  const notes = "Auto-generated ending slide.";

  return `---
type: ending
transition: fade
notes: |
  ${notes}
---

# ${heading}

${body}
`;
}

function main(): void {
  const args = parseArgs();
  const root = findProjectRoot();
  const deckDir = path.join(root, "decks", args.deck);

  if (fs.existsSync(deckDir)) {
    const stat = fs.statSync(deckDir);
    if (!stat.isDirectory()) {
      fail(`Path exists and is not a directory: ${deckDir}`);
    }
    if (!args.overwrite) {
      fail(
        `Deck directory already exists: decks/${args.deck} (use --overwrite to replace)`,
      );
    }
    fs.rmSync(deckDir, { recursive: true, force: true });
  }

  fs.mkdirSync(deckDir, { recursive: true });

  const points = extractPoints(args.brief);
  const middleSlides = createMiddleSlides(args.slides, args.lang, points);
  const padWidth = Math.max(2, String(args.slides).length);
  const written: string[] = [];

  function write(relPath: string, content: string): void {
    const abs = path.join(deckDir, relPath);
    fs.writeFileSync(abs, content.endsWith("\n") ? content : `${content}\n`, "utf8");
    written.push(path.relative(root, abs));
  }

  write("deck.config.ts", buildDeckConfig(args));
  write(`${String(1).padStart(padWidth, "0")}-cover.mdx`, buildCoverSlide(args, points));

  let sectionNo = 1;
  let contentNo = 1;
  for (let i = 0; i < middleSlides.length; i++) {
    const number = i + 2;
    const current = middleSlides[i];
    const base = String(number).padStart(padWidth, "0");

    if (current.kind === "section") {
      write(
        `${base}-section-${sectionNo}.mdx`,
        buildSectionSlide(current.title, current.bullets, sectionNo),
      );
      sectionNo++;
    } else {
      write(
        `${base}-content-${contentNo}.mdx`,
        buildContentSlide(current.title, current.bullets, contentNo),
      );
      contentNo++;
    }
  }

  write(
    `${String(args.slides).padStart(padWidth, "0")}-ending.mdx`,
    buildEndingSlide(),
  );

  process.stdout.write("Deck scaffold generated.\n");
  process.stdout.write(`Deck: decks/${args.deck}\n`);
  process.stdout.write(`Title: ${args.title}\n`);
  process.stdout.write(`Slides: ${args.slides}\n`);
  process.stdout.write(`Language: ${args.lang}\n`);
  process.stdout.write(`Overwritten: ${args.overwrite ? "yes" : "no"}\n`);
  process.stdout.write("Generated files:\n");
  for (const item of written) {
    process.stdout.write(`- ${item}\n`);
  }
}

main();
