#!/usr/bin/env npx tsx
/**
 * deck-scaffold-from-brief: Create a new deck scaffold from a short brief.
 *
 * Usage:
 *   npx tsx .codex/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \
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
type ContentVariant = "cards" | "comparison" | "stats" | "timeline" | "steps";

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
  variant?: ContentVariant;
}

interface ScaffoldCopy {
  fallbackKeyTheme: string;
  fallbackSupport: string;
  fallbackExample: string;
  coverNote: string;
  coverEyebrow: string;
  coverSubtitle: string;
  coverHint: string;
  coverTags: [string, string, string];
  sectionMarker: string;
  sectionNote: string;
  sectionFallbackLine1: string;
  sectionFallbackLine2: string;
  contentNote: string;
  contentLead: string;
  contentCardLabel: string;
  contentCardHint: string;
  comparisonNote: string;
  comparisonLabels: [string, string, string];
  comparisonHints: [string, string];
  statsNote: string;
  statsSummaryTitles: [string, string];
  statsSummaryHints: [string, string];
  timelineNote: string;
  timelinePhasePrefix: string;
  timelineDescriptions: [string, string, string, string];
  stepsNote: string;
  stepsLead: string;
  stepsFooter: string;
  endingHeading: string;
  endingBody: string;
  endingNote: string;
  endingActions: [string, string, string];
  endingFooter: string;
}

const USAGE = `
Usage:
  npx tsx .codex/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \\
    --deck <deck-name> --title "<deck title>" --brief "<brief>"

Required:
  --deck       Deck directory name (created under decks/)
  --title      Deck title
  --brief      Source brief text

Optional:
  --slides     Number of slides to generate (default: 10, minimum: 4)
  --lang       ja | en (default: en)
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
  let lang: Lang = "en";
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

function clampText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function getScaffoldCopy(lang: Lang): ScaffoldCopy {
  if (lang === "ja") {
    return {
      fallbackKeyTheme: "主要テーマ",
      fallbackSupport: "補足ポイント",
      fallbackExample: "事例やデータを追加",
      coverNote: "ブリーフから自動生成した表紙スライド。",
      coverEyebrow: "Deck Scaffold",
      coverSubtitle: "構成の核を素早く共有するための、Sample Deck 風ドラフト",
      coverHint: "この骨子をベースに、具体データ・図解・事例を加えて完成版に仕上げてください。",
      coverTags: ["Brief起点", "MDX構成", "編集前提"],
      sectionMarker: "SECTION",
      sectionNote: "セクション区切りのドラフト。",
      sectionFallbackLine1: "ここで話題を切り替えます。",
      sectionFallbackLine2: "次のスライドで詳細を展開します。",
      contentNote: "下書きスライド。根拠、図解、事例を追加して完成度を上げてください。",
      contentLead: "主要論点を3つのカードに整理しています。必要に応じて事例、数値、図版へ置き換えてください。",
      contentCardLabel: "POINT",
      contentCardHint: "ここに根拠、データ、具体例を追加",
      comparisonNote: "比較スライドのドラフト。",
      comparisonLabels: ["CURRENT", "TARGET", "TAKEAWAY"],
      comparisonHints: ["現状の課題や制約をここに整理", "目指す状態や設計方針をここに整理"],
      statsNote: "統計・指標風スライドのドラフト。",
      statsSummaryTitles: ["Current Focus", "Next Move"],
      statsSummaryHints: ["いま最優先で追う観点を明確化", "次の更新で数値、期間、責任者を追加"],
      timelineNote: "タイムラインスライドのドラフト。",
      timelinePhasePrefix: "PHASE",
      timelineDescriptions: [
        "論点の起点を定義します。",
        "検証すべき論点を具体化します。",
        "実行の軸を固めます。",
        "最終的な到達点を共有します。",
      ],
      stepsNote: "ステップ型スライドのドラフト。",
      stepsLead: "3 つの実行ステップとして整理しています。必要に応じて担当、期限、成果物へ具体化してください。",
      stepsFooter: "このまま実行計画に育てる場合は、各ステップに owner と期限を追記してください。",
      endingHeading: "Thank You!",
      endingBody: "この下書きをベースに、具体情報とビジュアルを加えてプレゼンに仕上げてください。",
      endingNote: "自動生成したエンディングスライド。",
      endingActions: ["内容を磨く", "図解を追加", "発表準備"],
      endingFooter: "Amaroad なら、このまま MDX を育てて完成版まで持っていけます。",
    };
  }

  return {
    fallbackKeyTheme: "Key theme",
    fallbackSupport: "Supporting point",
    fallbackExample: "Add examples and data",
    coverNote: "Auto-generated cover slide from brief.",
    coverEyebrow: "Deck Scaffold",
    coverSubtitle: "A Sample Deck inspired draft for shaping the narrative quickly",
    coverHint: "Use this scaffold as the base, then add concrete data, diagrams, and examples.",
    coverTags: ["Brief-Driven", "MDX Scaffold", "Ready to Edit"],
    sectionMarker: "SECTION",
    sectionNote: "Draft section divider.",
    sectionFallbackLine1: "Use this slide to pivot the story.",
    sectionFallbackLine2: "The following slides should develop the detail.",
    contentNote: "Draft content slide. Add evidence, visuals, and concrete examples.",
    contentLead: "The main points are organized as three cards. Replace them with real facts, visuals, and proof as you refine the deck.",
    contentCardLabel: "POINT",
    contentCardHint: "Add evidence, data, or a concrete example here",
    comparisonNote: "Draft comparison slide.",
    comparisonLabels: ["CURRENT", "TARGET", "TAKEAWAY"],
    comparisonHints: ["Summarize the current constraint or friction here", "Summarize the target state or design direction here"],
    statsNote: "Draft stats-style slide.",
    statsSummaryTitles: ["Current Focus", "Next Move"],
    statsSummaryHints: ["Clarify the primary dimension to track", "Add concrete numbers, timing, and ownership in the next pass"],
    timelineNote: "Draft timeline slide.",
    timelinePhasePrefix: "PHASE",
    timelineDescriptions: [
      "Define the starting context.",
      "Clarify the next decision point.",
      "Lock the execution path.",
      "Share the intended destination.",
    ],
    stepsNote: "Draft steps slide.",
    stepsLead: "The story is organized into three execution steps. Replace these with real owners, timing, and deliverables as you refine the deck.",
    stepsFooter: "If this becomes an execution plan, add clear owners and deadlines to each step.",
    endingHeading: "Thank You!",
    endingBody: "Use this scaffold as a base, then add concrete detail and visuals to make it presentation-ready.",
    endingNote: "Auto-generated ending slide.",
    endingActions: ["Refine Story", "Add Visuals", "Prepare Talk"],
    endingFooter: "Amaroad is designed so you can keep evolving the MDX until the final presentation is ready.",
  };
}

function extractPoints(brief: string): string[] {
  const chunks = brief
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/[.!?;。！？]+/))
    .flatMap((line) => line.split(/[、,]+/))
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
  const copy = getScaffoldCopy(lang);
  const variants: ContentVariant[] = ["cards", "comparison", "stats", "timeline", "steps"];
  const middleCount = slides - 2;
  const sectionPositions = new Set<number>([0]);

  for (let pos = 3; pos < middleCount; pos += 4) {
    if (pos < middleCount - 1) {
      sectionPositions.add(pos);
    }
  }

  const result: MiddleSlide[] = [];
  let contentIndex = 0;

  for (let pos = 0; pos < middleCount; pos++) {
    const pointA = pickPoint(
      points,
      pos * 2,
      `${copy.fallbackKeyTheme} ${pos + 1}`,
    );
    const pointB = pickPoint(
      points,
      pos * 2 + 1,
      `${copy.fallbackSupport} ${pos + 1}`,
    );
    const pointC = pickPoint(
      points,
      pos * 2 + 2,
      copy.fallbackExample,
    );

    if (sectionPositions.has(pos)) {
      result.push({
        kind: "section",
        title: cleanLine(pointA),
        bullets: [cleanLine(pointB), cleanLine(pointC)],
      });
    } else {
      const pointD = pickPoint(
        points,
        pos * 2 + 3,
        copy.fallbackExample,
      );

      result.push({
        kind: "content",
        title: cleanLine(pointA),
        bullets: [cleanLine(pointB), cleanLine(pointC), cleanLine(pointD)],
        variant: variants[contentIndex % variants.length],
      });
      contentIndex++;
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
    "Inter, sans-serif";
  const bodyFont =
    args.lang === "ja" ? "Noto Sans JP, sans-serif" : "Inter, sans-serif";

  return `import { defineConfig } from "../../src/lib/deck-config";

export default defineConfig({
  title: "${escapeTsString(args.title)}",
  logo: {
    src: "/amaroad-logo.svg",
    position: "top-right",
  },
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
      primary: "#02001A",
      secondary: "#02001A",
      background: "#FFFFFF",
      text: "#1a1a1a",
      textMuted: "#555555",
      surface: "#F5F5F5",
      border: "#E5E7EB",
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
  const copy = getScaffoldCopy(args.lang);
  const summary = clampText(cleanLine(points[0] ?? args.brief), 110);
  const [tag1, tag2, tag3] = copy.coverTags;

  return `---
type: cover
transition: fade
notes: |
  ${copy.coverNote}
---

<div style={{ display: "flex", flex: 1, alignSelf: "stretch", margin: "-96px -96px -80px -96px" }}>
  <div style={{ width: "42%", background: "#02001A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
      <div style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.25)" }} />
      <span style={{ fontSize: "1.8rem", fontWeight: 600, color: "rgba(255,255,255,0.42)", letterSpacing: "0.28em", textTransform: "uppercase" }}>${copy.coverEyebrow}</span>
      <div style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.25)" }} />
    </div>
    <span style={{ fontSize: "6.4rem", fontWeight: 900, fontFamily: "var(--slide-font-heading)", color: "#FFFFFF", letterSpacing: "-0.03em", lineHeight: 0.9, textAlign: "center" }}>${cleanLine(args.title)}</span>
  </div>

  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "4rem 5rem" }}>
    <p style={{ fontSize: "3.4rem", color: "#02001A", fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.01em", margin: 0 }}>${copy.coverSubtitle}</p>
    <p style={{ fontSize: "2rem", color: "#555", lineHeight: 1.7, margin: "1.8rem 0 0" }}>${summary}</p>

    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "2.5rem", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.75rem 1.6rem", border: "1px solid #E5E7EB", borderRadius: "999px" }}>
        <Icon name="terminal" size={20} color="#02001A" />
        <span style={{ fontSize: "1.8rem", color: "#666", fontWeight: 500, letterSpacing: "0.03em" }}>${tag1}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.75rem 1.6rem", border: "1px solid #E5E7EB", borderRadius: "999px" }}>
        <Icon name="file-code" size={20} color="#02001A" />
        <span style={{ fontSize: "1.8rem", color: "#666", fontWeight: 500, letterSpacing: "0.03em" }}>${tag2}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.75rem 1.6rem", border: "1px solid #E5E7EB", borderRadius: "999px" }}>
        <Icon name="zap" size={20} color="#02001A" />
        <span style={{ fontSize: "1.8rem", color: "#666", fontWeight: 500, letterSpacing: "0.03em" }}>${tag3}</span>
      </div>
    </div>

    <p style={{ fontSize: "1.8rem", color: "#02001A", margin: "2.2rem 0 0", lineHeight: 1.7 }}>${copy.coverHint}</p>
  </div>
</div>
`;
}

function buildSectionSlide(
  args: Args,
  title: string,
  bullets: string[],
  sectionNo: number,
): string {
  const copy = getScaffoldCopy(args.lang);
  const notes = `${copy.sectionNote} ${sectionNo}.`;

  const line1 = cleanLine(bullets[0] ?? copy.sectionFallbackLine1);
  const line2 = cleanLine(
    bullets[1] ?? copy.sectionFallbackLine2,
  );

  return `---
type: section
transition: fade
notes: |
  ${notes}
---

<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", flex: 1, gap: "1.5rem" }}>
  <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#02001A", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Icon name="layers" size={48} color="#FFF" />
  </div>

  <p style={{ fontSize: "1.6rem", color: "#888", fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", margin: 0 }}>
    ${copy.sectionMarker} ${String(sectionNo).padStart(2, "0")}
  </p>

  # ${cleanLine(title)}

  <p style={{ fontSize: "2rem", color: "#666", maxWidth: "60%", lineHeight: 1.7, margin: 0 }}>
    ${line1}<br/>${line2}
  </p>
</div>
`;
}

function buildContentSlide(
  args: Args,
  title: string,
  bullets: string[],
  contentNo: number,
): string {
  const copy = getScaffoldCopy(args.lang);
  const notes = `${copy.contentNote} ${contentNo}.`;

  const b1 = cleanLine(
    bullets[0] ?? copy.fallbackKeyTheme,
  );
  const b2 = cleanLine(
    bullets[1] ?? copy.fallbackSupport,
  );
  const b3 = cleanLine(
    bullets[2] ?? copy.fallbackExample,
  );
  const cardIcons = ["file-code", "monitor", "palette"];
  const cardItems = [b1, b2, b3]
    .map((item, index) => `  <div style={{ background: "#F5F5F5", borderRadius: "16px", padding: "2.25rem", display: "flex", flexDirection: "column", gap: "1rem", border: "1px solid #E5E7EB" }}>
    <div style={{ width: 64, height: 64, borderRadius: "16px", background: "#02001A", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name="${cardIcons[index]}" size={30} color="#FFF" />
    </div>
    <span style={{ fontSize: "1.6rem", color: "#64748B", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>${copy.contentCardLabel} ${String(index + 1).padStart(2, "0")}</span>
    <span style={{ fontSize: "2.3rem", fontWeight: 700, color: "#02001A", lineHeight: 1.35 }}>${item}</span>
    <p style={{ fontSize: "1.8rem", color: "#555", lineHeight: 1.6, margin: 0 }}>${copy.contentCardHint}</p>
  </div>`)
    .join("\n");

  return `---
type: content
transition: fade
notes: |
  ${notes}
---

# ${cleanLine(title)}

<p style={{ fontSize: "2rem", color: "#555", margin: "0.8rem 0 2rem", lineHeight: 1.6 }}>
  ${copy.contentLead}
</p>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.6rem", marginTop: "1rem", height: "calc(100% - 9rem)" }}>
${cardItems}
</div>
`;
}

function buildComparisonSlide(
  args: Args,
  title: string,
  bullets: string[],
  contentNo: number,
): string {
  const copy = getScaffoldCopy(args.lang);
  const [leftLabel, rightLabel, takeawayLabel] = copy.comparisonLabels;
  const [leftHint, rightHint] = copy.comparisonHints;
  const left = clampText(cleanLine(bullets[0] ?? copy.fallbackKeyTheme), 56);
  const right = clampText(cleanLine(bullets[1] ?? copy.fallbackSupport), 56);
  const takeaway = clampText(cleanLine(bullets[2] ?? copy.fallbackExample), 96);

  return `---
type: comparison
transition: fade
notes: |
  ${copy.comparisonNote} ${contentNo}.
---

# ${clampText(cleanLine(title), 56)}

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6rem", marginTop: "1.5rem" }}>
  <div style={{ background: "#F5F5F5", borderRadius: "18px", padding: "2.25rem", border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: "1rem" }}>
    <p style={{ fontSize: "1.5rem", color: "#64748B", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>${leftLabel}</p>
    <p style={{ fontSize: "3rem", color: "#02001A", fontWeight: 700, lineHeight: 1.3, margin: 0 }}>${left}</p>
    <p style={{ fontSize: "1.8rem", color: "#555", lineHeight: 1.65, margin: 0 }}>${leftHint}</p>
  </div>
  <div style={{ background: "#02001A", borderRadius: "18px", padding: "2.25rem", border: "1px solid #02001A", display: "flex", flexDirection: "column", gap: "1rem" }}>
    <p style={{ fontSize: "1.5rem", color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>${rightLabel}</p>
    <p style={{ fontSize: "3rem", color: "#FFFFFF", fontWeight: 700, lineHeight: 1.3, margin: 0 }}>${right}</p>
    <p style={{ fontSize: "1.8rem", color: "rgba(255,255,255,0.78)", lineHeight: 1.65, margin: 0 }}>${rightHint}</p>
  </div>
</div>

<div style={{ marginTop: "1.6rem", borderRadius: "18px", padding: "1.8rem 2rem", background: "#F8FAFC", border: "1px solid #E5E7EB" }}>
  <p style={{ fontSize: "1.5rem", color: "#64748B", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>${takeawayLabel}</p>
  <p style={{ fontSize: "2.2rem", color: "#02001A", lineHeight: 1.55, margin: "0.8rem 0 0" }}>${takeaway}</p>
</div>
`;
}

function buildStatsSlide(
  args: Args,
  title: string,
  bullets: string[],
  contentNo: number,
): string {
  const copy = getScaffoldCopy(args.lang);
  const [summaryTitle, nextTitle] = copy.statsSummaryTitles;
  const [summaryHint, nextHint] = copy.statsSummaryHints;
  const statItems = [
    clampText(cleanLine(title), 26),
    clampText(cleanLine(bullets[0] ?? copy.fallbackKeyTheme), 26),
    clampText(cleanLine(bullets[1] ?? copy.fallbackSupport), 26),
    clampText(cleanLine(bullets[2] ?? copy.fallbackExample), 26),
  ];

  const statCards = statItems
    .map((item, index) => `  <div style={{ textAlign: "center", padding: "2.2rem 1.4rem", borderRadius: "1rem", background: "#F5F5F5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #E5E7EB" }}>
    <p style={{ fontSize: "3.6rem", fontWeight: 800, margin: 0, color: "#02001A" }}>${String(index + 1).padStart(2, "0")}</p>
    <p style={{ fontSize: "1.7rem", color: "#555", margin: "0.8rem 0 0", lineHeight: 1.45 }}>${item}</p>
  </div>`)
    .join("\n");

  return `---
type: stats
transition: fade
notes: |
  ${copy.statsNote} ${contentNo}.
---

# ${clampText(cleanLine(title), 56)}

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1.4rem", marginTop: "1.5rem" }}>
${statCards}
</div>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6rem", marginTop: "1.8rem" }}>
  <div style={{ padding: "1.9rem 2rem", borderRadius: "1rem", background: "#F5F5F5", border: "1px solid #E5E7EB" }}>
    <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "#02001A", margin: 0 }}>${summaryTitle}</p>
    <p style={{ fontSize: "1.8rem", color: "#555", lineHeight: 1.65, margin: "0.7rem 0 0" }}>${summaryHint}</p>
  </div>
  <div style={{ padding: "1.9rem 2rem", borderRadius: "1rem", background: "#02001A", border: "1px solid #02001A" }}>
    <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "#FFFFFF", margin: 0 }}>${nextTitle}</p>
    <p style={{ fontSize: "1.8rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.65, margin: "0.7rem 0 0" }}>${nextHint}</p>
  </div>
</div>
`;
}

function buildTimelineSlide(
  args: Args,
  title: string,
  bullets: string[],
  contentNo: number,
): string {
  const copy = getScaffoldCopy(args.lang);
  const items = [
    clampText(cleanLine(title), 42),
    clampText(cleanLine(bullets[0] ?? copy.fallbackKeyTheme), 42),
    clampText(cleanLine(bullets[1] ?? copy.fallbackSupport), 42),
    clampText(cleanLine(bullets[2] ?? copy.fallbackExample), 42),
  ];

  const timelineItems = items
    .map((item, index) => `  <TimelineItem date="${copy.timelinePhasePrefix} ${String(index + 1).padStart(2, "0")}" title="${item}"${index === items.length - 1 ? " active" : ""}>
    <p style={{ margin: 0 }}>${copy.timelineDescriptions[index]}</p>
  </TimelineItem>`)
    .join("\n");

  return `---
type: timeline
transition: fade
notes: |
  ${copy.timelineNote} ${contentNo}.
---

# ${clampText(cleanLine(title), 56)}

<Timeline>
${timelineItems}
</Timeline>
`;
}

function buildStepsSlide(
  args: Args,
  title: string,
  bullets: string[],
  contentNo: number,
): string {
  const copy = getScaffoldCopy(args.lang);
  const steps = [
    clampText(cleanLine(bullets[0] ?? copy.fallbackKeyTheme), 44),
    clampText(cleanLine(bullets[1] ?? copy.fallbackSupport), 44),
    clampText(cleanLine(bullets[2] ?? copy.fallbackExample), 44),
  ];

  const stepCards = steps
    .map((step, index) => `  <div style={{ textAlign: "center", background: "#F5F5F5", borderRadius: "1rem", padding: "2.4rem 1.8rem", border: "1px solid #E5E7EB" }}>
    <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#02001A", color: "#FFF", fontSize: "2.5rem", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>${index + 1}</div>
    <h3 style={{ fontSize: "2.2rem", margin: "1.2rem 0 0.8rem" }}>${step}</h3>
    <p style={{ fontSize: "1.7rem", color: "#555", lineHeight: 1.6, margin: 0 }}>${copy.contentCardHint}</p>
  </div>`)
    .join("\n");

  return `---
type: agenda
transition: fade
notes: |
  ${copy.stepsNote} ${contentNo}.
---

# ${clampText(cleanLine(title), 56)}

<p style={{ fontSize: "2rem", color: "#555", margin: "0.8rem 0 2rem", lineHeight: 1.6 }}>
  ${copy.stepsLead}
</p>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2rem", marginTop: "1rem", height: "calc(100% - 10rem)", alignItems: "start" }}>
${stepCards}
</div>

<p style={{ fontSize: "1.8rem", color: "#02001A", margin: "1.8rem 0 0", lineHeight: 1.7 }}>
  ${copy.stepsFooter}
</p>
`;
}

function buildVariantSlide(
  args: Args,
  slide: MiddleSlide,
  contentNo: number,
): string {
  switch (slide.variant) {
    case "comparison":
      return buildComparisonSlide(args, slide.title, slide.bullets, contentNo);
    case "stats":
      return buildStatsSlide(args, slide.title, slide.bullets, contentNo);
    case "timeline":
      return buildTimelineSlide(args, slide.title, slide.bullets, contentNo);
    case "steps":
      return buildStepsSlide(args, slide.title, slide.bullets, contentNo);
    case "cards":
    default:
      return buildContentSlide(args, slide.title, slide.bullets, contentNo);
  }
}

function buildEndingSlide(args: Args): string {
  const copy = getScaffoldCopy(args.lang);
  const [action1, action2, action3] = copy.endingActions;

  return `---
type: ending
transition: fade
notes: |
  ${copy.endingNote}
---

<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", flex: 1, gap: "2rem" }}>
  <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#02001A", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Icon name="heart" size={48} color="#FFF" />
  </div>

  # ${copy.endingHeading}

  <p style={{ fontSize: "2.2rem", color: "#555", margin: 0, lineHeight: 1.6, maxWidth: "70%" }}>
    ${copy.endingBody}
  </p>

  <div style={{ display: "flex", gap: "3rem", marginTop: "0.5rem" }}>
    <div style={{ textAlign: "center" }}>
      <Icon name="book-open" size={36} color="#02001A" />
      <p style={{ fontSize: "1.8rem", color: "#666", margin: "0.75rem 0 0" }}>${action1}</p>
    </div>
    <div style={{ textAlign: "center" }}>
      <Icon name="palette" size={36} color="#02001A" />
      <p style={{ fontSize: "1.8rem", color: "#666", margin: "0.75rem 0 0" }}>${action2}</p>
    </div>
    <div style={{ textAlign: "center" }}>
      <Icon name="message-circle" size={36} color="#02001A" />
      <p style={{ fontSize: "1.8rem", color: "#666", margin: "0.75rem 0 0" }}>${action3}</p>
    </div>
  </div>

  <p style={{ fontSize: "1.8rem", color: "#02001A", margin: 0, maxWidth: "64%", lineHeight: 1.7 }}>
    ${copy.endingFooter}
  </p>
</div>
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
        buildSectionSlide(args, current.title, current.bullets, sectionNo),
      );
      sectionNo++;
    } else {
      write(
        `${base}-content-${contentNo}.mdx`,
        buildVariantSlide(args, current, contentNo),
      );
      contentNo++;
    }
  }

  write(
    `${String(args.slides).padStart(padWidth, "0")}-ending.mdx`,
    buildEndingSlide(args),
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
