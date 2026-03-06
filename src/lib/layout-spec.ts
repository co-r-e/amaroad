/**
 * Strict layout specs for slide authoring.
 *
 * Every frame is defined relative to the inviolable content area, not the full
 * 1920x1080 slide. `x`, `y`, `w`, and `h` are percentages of that safe area.
 *
 * These specs are intended for a future strict authoring mode where:
 * - authors provide structured content rather than arbitrary JSX
 * - overflow is detected at real slide size
 * - content is paginated by `split` rules instead of visually overflowing
 */

export type LayoutId =
  | "editorialCover"
  | "coverMinimal"
  | "statementSplit"
  | "statementSplitReverse"
  | "dualPanel"
  | "tripleCards"
  | "workflowQuad"
  | "workflowTimeline"
  | "threeLayerSystem"
  | "comparisonA"
  | "quoteSpotlight"
  | "closingSignal";

export type LayoutFamily =
  | "cover"
  | "statement"
  | "cards"
  | "process"
  | "system"
  | "comparison"
  | "quote"
  | "close";

export type SafeAreaPreset =
  | "content"
  | "cover"
  | "section"
  | "quote"
  | "image-full";

export type ThemeMode = "light" | "dark" | "either";
export type LayoutDensity = "airy" | "balanced" | "compact";
export type SlotBlockType =
  | "text"
  | "richText"
  | "quote"
  | "stat"
  | "card"
  | "cardList"
  | "steps"
  | "comparisonItems"
  | "timelineItems";

export type SplitUnit = "none" | "paragraph" | "card" | "step" | "item";

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SlotTypography {
  fontSize: number;
  lineHeight: number;
  fontWeight?: number;
  letterSpacing?: string;
}

export interface SlotDefinition {
  allowed: SlotBlockType[];
  required?: boolean;
  maxItems?: number;
  maxChars?: number;
  maxLines?: number;
  frame: FrameRect;
  typography: SlotTypography;
}

export interface SplitPolicy {
  order: string[];
  unitBySlot: Record<string, SplitUnit>;
  continuationLayout?: LayoutId;
  repeatSlots?: string[];
  hardFailSlots?: string[];
}

export interface LayoutVariant {
  id: string;
  tone: "light" | "dark";
  density: LayoutDensity;
  align: "left" | "center" | "right";
  accentMode: "neutral" | "orange";
}

export interface LayoutDefinition {
  id: LayoutId;
  family: LayoutFamily;
  slideType: "content" | "cover" | "section" | "ending";
  safeAreaPreset: SafeAreaPreset;
  themeMode: ThemeMode;
  density: LayoutDensity;
  supportedVariants: LayoutVariant[];
  slots: Record<string, SlotDefinition>;
  split: SplitPolicy;
  notes: string[];
}

const frame = (x: number, y: number, w: number, h: number): FrameRect => ({
  x,
  y,
  w,
  h,
});

const LIGHT_EDITORIAL_VARIANTS: LayoutVariant[] = [
  { id: "left-light-balanced-orange", tone: "light", density: "balanced", align: "left", accentMode: "orange" },
  { id: "left-light-airy-orange", tone: "light", density: "airy", align: "left", accentMode: "orange" },
  { id: "center-light-balanced-neutral", tone: "light", density: "balanced", align: "center", accentMode: "neutral" },
];

const LIGHT_STATEMENT_VARIANTS: LayoutVariant[] = [
  { id: "left-light-balanced-orange", tone: "light", density: "balanced", align: "left", accentMode: "orange" },
  { id: "left-light-compact-orange", tone: "light", density: "compact", align: "left", accentMode: "orange" },
  { id: "right-light-balanced-orange", tone: "light", density: "balanced", align: "right", accentMode: "orange" },
];

const LIGHT_CARD_VARIANTS: LayoutVariant[] = [
  { id: "left-light-balanced-orange", tone: "light", density: "balanced", align: "left", accentMode: "orange" },
  { id: "center-light-balanced-neutral", tone: "light", density: "balanced", align: "center", accentMode: "neutral" },
  { id: "left-light-compact-orange", tone: "light", density: "compact", align: "left", accentMode: "orange" },
];

const DARK_SYSTEM_VARIANTS: LayoutVariant[] = [
  { id: "left-dark-balanced-orange", tone: "dark", density: "balanced", align: "left", accentMode: "orange" },
  { id: "left-dark-compact-orange", tone: "dark", density: "compact", align: "left", accentMode: "orange" },
];

const LIGHT_PROCESS_VARIANTS: LayoutVariant[] = [
  { id: "left-light-balanced-orange", tone: "light", density: "balanced", align: "left", accentMode: "orange" },
  { id: "left-light-compact-orange", tone: "light", density: "compact", align: "left", accentMode: "orange" },
];

export const editorialCover: LayoutDefinition = {
  id: "editorialCover",
  family: "cover",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "light",
  density: "balanced",
  supportedVariants: LIGHT_EDITORIAL_VARIANTS,
  slots: {
    eyebrow: {
      allowed: ["text"],
      required: true,
      maxChars: 40,
      maxLines: 1,
      frame: frame(0, 0, 58, 7),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    chips: {
      allowed: ["cardList"],
      maxItems: 2,
      maxLines: 2,
      frame: frame(70, 0, 30, 7),
      typography: { fontSize: 16, lineHeight: 1.15, letterSpacing: "0.2em" },
    },
    kicker: {
      allowed: ["text"],
      required: true,
      maxChars: 40,
      maxLines: 1,
      frame: frame(0, 11, 48, 6),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    title: {
      allowed: ["text"],
      required: true,
      maxChars: 28,
      maxLines: 2,
      frame: frame(0, 16, 46, 18),
      typography: { fontSize: 92, lineHeight: 0.92, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    ledeCard: {
      allowed: ["card"],
      required: true,
      maxLines: 8,
      maxChars: 240,
      frame: frame(0, 44, 50, 24),
      typography: { fontSize: 24, lineHeight: 1.34 },
    },
    premiseCard: {
      allowed: ["card"],
      required: true,
      maxLines: 8,
      maxChars: 190,
      frame: frame(58, 18, 42, 26),
      typography: { fontSize: 20, lineHeight: 1.32 },
    },
    metaCards: {
      allowed: ["cardList"],
      maxItems: 2,
      maxLines: 4,
      frame: frame(58, 50, 42, 18),
      typography: { fontSize: 16, lineHeight: 1.28 },
    },
  },
  split: {
    order: ["metaCards", "ledeCard"],
    unitBySlot: {
      eyebrow: "none",
      chips: "card",
      kicker: "none",
      title: "none",
      ledeCard: "paragraph",
      premiseCard: "none",
      metaCards: "card",
    },
    hardFailSlots: ["title"],
  },
  notes: [
    "Use for opening slides with one decisive title and one premise card.",
    "Do not place process steps or comparisons here.",
  ],
};

export const coverMinimal: LayoutDefinition = {
  id: "coverMinimal",
  family: "cover",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "either",
  density: "airy",
  supportedVariants: [
    { id: "left-light-airy-orange", tone: "light", density: "airy", align: "left", accentMode: "orange" },
    { id: "left-dark-airy-orange", tone: "dark", density: "airy", align: "left", accentMode: "orange" },
    { id: "center-light-airy-neutral", tone: "light", density: "airy", align: "center", accentMode: "neutral" },
  ],
  slots: {
    eyebrow: {
      allowed: ["text"],
      required: true,
      maxChars: 36,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    title: {
      allowed: ["text"],
      required: true,
      maxChars: 24,
      maxLines: 2,
      frame: frame(0, 18, 70, 20),
      typography: { fontSize: 96, lineHeight: 0.94, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    lede: {
      allowed: ["richText"],
      maxChars: 180,
      maxLines: 4,
      frame: frame(0, 42, 44, 14),
      typography: { fontSize: 28, lineHeight: 1.34 },
    },
    signoff: {
      allowed: ["text"],
      maxChars: 64,
      maxLines: 2,
      frame: frame(0, 58, 36, 8),
      typography: { fontSize: 22, lineHeight: 1.3, letterSpacing: "0.18em" },
    },
  },
  split: {
    order: ["lede"],
    unitBySlot: {
      eyebrow: "none",
      title: "none",
      lede: "paragraph",
      signoff: "none",
    },
    hardFailSlots: ["title"],
  },
  notes: [
    "Use when the title is the main visual element.",
    "Keep auxiliary content deliberately sparse.",
  ],
};

export const statementSplit: LayoutDefinition = {
  id: "statementSplit",
  family: "statement",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "either",
  density: "balanced",
  supportedVariants: LIGHT_STATEMENT_VARIANTS,
  slots: {
    sectionLabel: {
      allowed: ["text"],
      required: true,
      maxChars: 32,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    headline: {
      allowed: ["text"],
      required: true,
      maxChars: 56,
      maxLines: 3,
      frame: frame(0, 10, 44, 18),
      typography: { fontSize: 72, lineHeight: 0.98, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    body: {
      allowed: ["richText"],
      required: true,
      maxChars: 260,
      maxLines: 6,
      frame: frame(0, 30, 40, 16),
      typography: { fontSize: 28, lineHeight: 1.4 },
    },
    callout: {
      allowed: ["card"],
      maxChars: 160,
      maxLines: 6,
      frame: frame(54, 10, 46, 14),
      typography: { fontSize: 24, lineHeight: 1.34 },
    },
    emphasisCard: {
      allowed: ["card"],
      maxChars: 160,
      maxLines: 8,
      frame: frame(0, 48, 34, 18),
      typography: { fontSize: 22, lineHeight: 1.32 },
    },
    pointList: {
      allowed: ["cardList"],
      maxItems: 3,
      maxLines: 9,
      frame: frame(38, 30, 62, 36),
      typography: { fontSize: 20, lineHeight: 1.3 },
    },
  },
  split: {
    order: ["pointList", "body"],
    unitBySlot: {
      sectionLabel: "none",
      headline: "none",
      body: "paragraph",
      callout: "none",
      emphasisCard: "none",
      pointList: "card",
    },
    continuationLayout: "statementSplit",
    repeatSlots: ["sectionLabel", "headline", "callout"],
    hardFailSlots: ["headline"],
  },
  notes: [
    "Best for positioning, argument framing, and strategy statements.",
    "The emphasis card should contain the distilled thesis, not a long paragraph.",
  ],
};

export const statementSplitReverse: LayoutDefinition = {
  id: "statementSplitReverse",
  family: "statement",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "either",
  density: "balanced",
  supportedVariants: [
    { id: "right-light-balanced-orange", tone: "light", density: "balanced", align: "right", accentMode: "orange" },
    { id: "right-light-compact-orange", tone: "light", density: "compact", align: "right", accentMode: "orange" },
    { id: "right-dark-balanced-orange", tone: "dark", density: "balanced", align: "right", accentMode: "orange" },
  ],
  slots: {
    sectionLabel: {
      allowed: ["text"],
      required: true,
      maxChars: 32,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    headline: {
      allowed: ["text"],
      required: true,
      maxChars: 56,
      maxLines: 3,
      frame: frame(56, 10, 44, 18),
      typography: { fontSize: 72, lineHeight: 0.98, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    body: {
      allowed: ["richText"],
      required: true,
      maxChars: 260,
      maxLines: 6,
      frame: frame(60, 30, 40, 16),
      typography: { fontSize: 28, lineHeight: 1.4 },
    },
    callout: {
      allowed: ["card"],
      maxChars: 160,
      maxLines: 6,
      frame: frame(0, 8, 48, 20),
      typography: { fontSize: 24, lineHeight: 1.34 },
    },
    emphasisCard: {
      allowed: ["card"],
      maxChars: 160,
      maxLines: 8,
      frame: frame(62, 50, 38, 16),
      typography: { fontSize: 22, lineHeight: 1.32 },
    },
    pointList: {
      allowed: ["cardList"],
      maxItems: 3,
      maxLines: 4,
      frame: frame(0, 50, 58, 16),
      typography: { fontSize: 20, lineHeight: 1.3 },
    },
  },
  split: {
    order: ["pointList", "body"],
    unitBySlot: {
      sectionLabel: "none",
      headline: "none",
      body: "paragraph",
      callout: "none",
      emphasisCard: "none",
      pointList: "card",
    },
    continuationLayout: "statementSplitReverse",
    repeatSlots: ["sectionLabel", "headline", "callout"],
    hardFailSlots: ["headline"],
  },
  notes: [
    "Mirrors statementSplit for visual variety while keeping the same content contract.",
  ],
};

export const dualPanel: LayoutDefinition = {
  id: "dualPanel",
  family: "cards",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "either",
  density: "balanced",
  supportedVariants: LIGHT_CARD_VARIANTS,
  slots: {
    sectionLabel: {
      allowed: ["text"],
      required: true,
      maxChars: 32,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    headline: {
      allowed: ["text"],
      required: true,
      maxChars: 52,
      maxLines: 2,
      frame: frame(0, 10, 54, 15),
      typography: { fontSize: 64, lineHeight: 1.0, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    intro: {
      allowed: ["richText"],
      maxChars: 150,
      maxLines: 4,
      frame: frame(62, 10, 38, 15),
      typography: { fontSize: 22, lineHeight: 1.35 },
    },
    leftPanel: {
      allowed: ["card"],
      required: true,
      maxChars: 240,
      maxLines: 10,
      frame: frame(0, 28, 49, 38),
      typography: { fontSize: 22, lineHeight: 1.32 },
    },
    rightPanel: {
      allowed: ["card"],
      required: true,
      maxChars: 240,
      maxLines: 10,
      frame: frame(51, 28, 49, 38),
      typography: { fontSize: 22, lineHeight: 1.32 },
    },
  },
  split: {
    order: ["intro", "leftPanel", "rightPanel"],
    unitBySlot: {
      sectionLabel: "none",
      headline: "none",
      intro: "paragraph",
      leftPanel: "paragraph",
      rightPanel: "paragraph",
    },
    continuationLayout: "dualPanel",
    repeatSlots: ["sectionLabel", "headline", "intro"],
    hardFailSlots: ["headline"],
  },
  notes: [
    "Use for before/after, internal/external, or principle/tradeoff structures.",
  ],
};

export const tripleCards: LayoutDefinition = {
  id: "tripleCards",
  family: "cards",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "either",
  density: "balanced",
  supportedVariants: LIGHT_CARD_VARIANTS,
  slots: {
    sectionLabel: {
      allowed: ["text"],
      required: true,
      maxChars: 32,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    headline: {
      allowed: ["text"],
      required: true,
      maxChars: 54,
      maxLines: 2,
      frame: frame(0, 10, 58, 15),
      typography: { fontSize: 58, lineHeight: 1.0, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    intro: {
      allowed: ["richText"],
      maxChars: 160,
      maxLines: 4,
      frame: frame(64, 10, 36, 14),
      typography: { fontSize: 22, lineHeight: 1.35 },
    },
    cards: {
      allowed: ["cardList"],
      required: true,
      maxItems: 3,
      maxLines: 6,
      frame: frame(0, 26, 100, 42),
      typography: { fontSize: 19, lineHeight: 1.28 },
    },
  },
  split: {
    order: ["cards", "intro"],
    unitBySlot: {
      sectionLabel: "none",
      headline: "none",
      intro: "paragraph",
      cards: "card",
    },
    continuationLayout: "tripleCards",
    repeatSlots: ["sectionLabel", "headline", "intro"],
    hardFailSlots: ["headline"],
  },
  notes: [
    "Best for three-part frameworks, principles, or product pillars.",
  ],
};

export const workflowQuad: LayoutDefinition = {
  id: "workflowQuad",
  family: "process",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "either",
  density: "compact",
  supportedVariants: LIGHT_PROCESS_VARIANTS,
  slots: {
    sectionLabel: {
      allowed: ["text"],
      required: true,
      maxChars: 32,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    headline: {
      allowed: ["text"],
      required: true,
      maxChars: 56,
      maxLines: 2,
      frame: frame(0, 10, 48, 15),
      typography: { fontSize: 52, lineHeight: 1.0, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    intro: {
      allowed: ["richText"],
      maxChars: 140,
      maxLines: 3,
      frame: frame(60, 10, 40, 15),
      typography: { fontSize: 22, lineHeight: 1.35 },
    },
    narrativePanel: {
      allowed: ["card"],
      maxChars: 150,
      maxLines: 8,
      frame: frame(0, 30, 24, 34),
      typography: { fontSize: 18, lineHeight: 1.3 },
    },
    steps: {
      allowed: ["steps"],
      required: true,
      maxItems: 4,
      maxLines: 20,
      frame: frame(28, 30, 72, 34),
      typography: { fontSize: 18, lineHeight: 1.28 },
    },
  },
  split: {
    order: ["steps", "intro"],
    unitBySlot: {
      sectionLabel: "none",
      headline: "none",
      intro: "paragraph",
      narrativePanel: "none",
      steps: "step",
    },
    continuationLayout: "workflowQuad",
    repeatSlots: ["sectionLabel", "headline", "intro", "narrativePanel"],
    hardFailSlots: ["headline"],
  },
  notes: [
    "Designed for four-step sequences with strong card rhythm.",
  ],
};

export const workflowTimeline: LayoutDefinition = {
  id: "workflowTimeline",
  family: "process",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "either",
  density: "balanced",
  supportedVariants: [
    { id: "left-light-balanced-orange", tone: "light", density: "balanced", align: "left", accentMode: "orange" },
    { id: "left-dark-balanced-orange", tone: "dark", density: "balanced", align: "left", accentMode: "orange" },
  ],
  slots: {
    sectionLabel: {
      allowed: ["text"],
      required: true,
      maxChars: 32,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    headline: {
      allowed: ["text"],
      required: true,
      maxChars: 56,
      maxLines: 2,
      frame: frame(0, 10, 50, 15),
      typography: { fontSize: 60, lineHeight: 1.0, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    intro: {
      allowed: ["richText"],
      maxChars: 120,
      maxLines: 3,
      frame: frame(58, 10, 42, 15),
      typography: { fontSize: 22, lineHeight: 1.35 },
    },
    timeline: {
      allowed: ["timelineItems"],
      required: true,
      maxItems: 5,
      maxLines: 5,
      frame: frame(0, 30, 100, 34),
      typography: { fontSize: 18, lineHeight: 1.28 },
    },
  },
  split: {
    order: ["timeline", "intro"],
    unitBySlot: {
      sectionLabel: "none",
      headline: "none",
      intro: "paragraph",
      timeline: "item",
    },
    continuationLayout: "workflowTimeline",
    repeatSlots: ["sectionLabel", "headline", "intro"],
    hardFailSlots: ["headline"],
  },
  notes: [
    "Use when chronology matters more than equal card emphasis.",
  ],
};

export const threeLayerSystem: LayoutDefinition = {
  id: "threeLayerSystem",
  family: "system",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "dark",
  density: "balanced",
  supportedVariants: DARK_SYSTEM_VARIANTS,
  slots: {
    sectionLabel: {
      allowed: ["text"],
      required: true,
      maxChars: 32,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    headline: {
      allowed: ["text"],
      required: true,
      maxChars: 52,
      maxLines: 2,
      frame: frame(0, 10, 46, 15),
      typography: { fontSize: 64, lineHeight: 1.0, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    summary: {
      allowed: ["richText"],
      maxChars: 150,
      maxLines: 4,
      frame: frame(58, 10, 42, 15),
      typography: { fontSize: 22, lineHeight: 1.35 },
    },
    layers: {
      allowed: ["cardList"],
      required: true,
      maxItems: 3,
      maxLines: 5,
      frame: frame(0, 28, 54, 38),
      typography: { fontSize: 18, lineHeight: 1.28 },
    },
    workflow: {
      allowed: ["card"],
      required: true,
      maxChars: 150,
      maxLines: 10,
      frame: frame(58, 28, 42, 38),
      typography: { fontSize: 20, lineHeight: 1.3 },
    },
  },
  split: {
    order: ["layers", "summary"],
    unitBySlot: {
      sectionLabel: "none",
      headline: "none",
      summary: "paragraph",
      layers: "card",
      workflow: "paragraph",
    },
    continuationLayout: "threeLayerSystem",
    repeatSlots: ["sectionLabel", "headline", "summary"],
    hardFailSlots: ["headline"],
  },
  notes: [
    "Use for architecture, system layers, or conceptual stacks on a dark stage.",
  ],
};

export const comparisonA: LayoutDefinition = {
  id: "comparisonA",
  family: "comparison",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "either",
  density: "balanced",
  supportedVariants: [
    { id: "left-light-balanced-orange", tone: "light", density: "balanced", align: "left", accentMode: "orange" },
    { id: "left-dark-balanced-orange", tone: "dark", density: "balanced", align: "left", accentMode: "orange" },
  ],
  slots: {
    sectionLabel: {
      allowed: ["text"],
      required: true,
      maxChars: 32,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    headline: {
      allowed: ["text"],
      required: true,
      maxChars: 52,
      maxLines: 2,
      frame: frame(0, 10, 54, 15),
      typography: { fontSize: 60, lineHeight: 1.0, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    leftColumn: {
      allowed: ["comparisonItems"],
      required: true,
      maxItems: 4,
      maxLines: 5,
      frame: frame(0, 30, 48, 34),
      typography: { fontSize: 20, lineHeight: 1.3 },
    },
    rightColumn: {
      allowed: ["comparisonItems"],
      required: true,
      maxItems: 4,
      maxLines: 5,
      frame: frame(52, 30, 48, 34),
      typography: { fontSize: 20, lineHeight: 1.3 },
    },
    verdict: {
      allowed: ["card"],
      maxChars: 140,
      maxLines: 4,
      frame: frame(60, 10, 40, 15),
      typography: { fontSize: 22, lineHeight: 1.34 },
    },
  },
  split: {
    order: ["leftColumn", "rightColumn"],
    unitBySlot: {
      sectionLabel: "none",
      headline: "none",
      leftColumn: "item",
      rightColumn: "item",
      verdict: "none",
    },
    continuationLayout: "comparisonA",
    repeatSlots: ["sectionLabel", "headline", "verdict"],
    hardFailSlots: ["headline"],
  },
  notes: [
    "Use for tradeoffs, before/after, or old/new operating models.",
  ],
};

export const quoteSpotlight: LayoutDefinition = {
  id: "quoteSpotlight",
  family: "quote",
  slideType: "content",
  safeAreaPreset: "content",
  themeMode: "either",
  density: "airy",
  supportedVariants: [
    { id: "center-light-airy-orange", tone: "light", density: "airy", align: "center", accentMode: "orange" },
    { id: "center-dark-airy-orange", tone: "dark", density: "airy", align: "center", accentMode: "orange" },
  ],
  slots: {
    sectionLabel: {
      allowed: ["text"],
      required: true,
      maxChars: 32,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    quote: {
      allowed: ["quote"],
      required: true,
      maxChars: 220,
      maxLines: 7,
      frame: frame(8, 16, 84, 26),
      typography: { fontSize: 48, lineHeight: 1.16, fontWeight: 700, letterSpacing: "-0.03em" },
    },
    attribution: {
      allowed: ["text"],
      maxChars: 72,
      maxLines: 2,
      frame: frame(8, 46, 40, 8),
      typography: { fontSize: 22, lineHeight: 1.3, letterSpacing: "0.18em" },
    },
    commentary: {
      allowed: ["richText"],
      maxChars: 160,
      maxLines: 4,
      frame: frame(56, 46, 36, 12),
      typography: { fontSize: 22, lineHeight: 1.35 },
    },
  },
  split: {
    order: ["commentary"],
    unitBySlot: {
      sectionLabel: "none",
      quote: "none",
      attribution: "none",
      commentary: "paragraph",
    },
    hardFailSlots: ["quote"],
  },
  notes: [
    "A quote slide should privilege the quote itself; commentary is optional and short.",
  ],
};

export const closingSignal: LayoutDefinition = {
  id: "closingSignal",
  family: "close",
  slideType: "ending",
  safeAreaPreset: "cover",
  themeMode: "either",
  density: "airy",
  supportedVariants: [
    { id: "left-light-airy-orange", tone: "light", density: "airy", align: "left", accentMode: "orange" },
    { id: "left-dark-airy-orange", tone: "dark", density: "airy", align: "left", accentMode: "orange" },
    { id: "center-light-airy-neutral", tone: "light", density: "airy", align: "center", accentMode: "neutral" },
  ],
  slots: {
    eyebrow: {
      allowed: ["text"],
      required: true,
      maxChars: 36,
      maxLines: 1,
      frame: frame(0, 0, 100, 8),
      typography: { fontSize: 20, lineHeight: 1.2, letterSpacing: "0.24em" },
    },
    title: {
      allowed: ["text"],
      required: true,
      maxChars: 28,
      maxLines: 2,
      frame: frame(0, 18, 54, 20),
      typography: { fontSize: 84, lineHeight: 0.95, fontWeight: 700, letterSpacing: "-0.05em" },
    },
    closeNote: {
      allowed: ["richText"],
      required: true,
      maxChars: 160,
      maxLines: 4,
      frame: frame(0, 42, 44, 14),
      typography: { fontSize: 28, lineHeight: 1.34 },
    },
    nextActions: {
      allowed: ["cardList"],
      maxItems: 3,
      maxLines: 4,
      frame: frame(56, 20, 44, 28),
      typography: { fontSize: 20, lineHeight: 1.3 },
    },
    signoff: {
      allowed: ["text"],
      maxChars: 80,
      maxLines: 2,
      frame: frame(0, 60, 36, 8),
      typography: { fontSize: 22, lineHeight: 1.3, letterSpacing: "0.18em" },
    },
  },
  split: {
    order: ["nextActions", "closeNote"],
    unitBySlot: {
      eyebrow: "none",
      title: "none",
      closeNote: "paragraph",
      nextActions: "card",
      signoff: "none",
    },
    repeatSlots: ["eyebrow", "title", "signoff"],
    hardFailSlots: ["title"],
  },
  notes: [
    "Use for closing pages, CTA pages, and final takeaway pages.",
  ],
};

export const LAYOUT_SPECS: LayoutDefinition[] = [
  editorialCover,
  coverMinimal,
  statementSplit,
  statementSplitReverse,
  dualPanel,
  tripleCards,
  workflowQuad,
  workflowTimeline,
  threeLayerSystem,
  comparisonA,
  quoteSpotlight,
  closingSignal,
];

export const LAYOUT_SPEC_MAP: Record<LayoutId, LayoutDefinition> = Object.fromEntries(
  LAYOUT_SPECS.map((spec) => [spec.id, spec]),
) as Record<LayoutId, LayoutDefinition>;

export const LAYOUT_IDS_BY_FAMILY: Record<LayoutFamily, LayoutId[]> = {
  cover: ["editorialCover", "coverMinimal"],
  statement: ["statementSplit", "statementSplitReverse"],
  cards: ["dualPanel", "tripleCards"],
  process: ["workflowQuad", "workflowTimeline"],
  system: ["threeLayerSystem"],
  comparison: ["comparisonA"],
  quote: ["quoteSpotlight"],
  close: ["closingSignal"],
};

export function getLayoutSpec(id: LayoutId): LayoutDefinition {
  return LAYOUT_SPEC_MAP[id];
}

export function isLayoutId(value: string): value is LayoutId {
  return value in LAYOUT_SPEC_MAP;
}
