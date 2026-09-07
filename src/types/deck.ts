export type SlideType =
  | "cover"
  | "section"
  | "content"
  | "comparison"
  | "stats"
  | "timeline"
  | "image-left"
  | "image-right"
  | "image-full"
  | "quote"
  | "agenda"
  | "ending";

export type TransitionType = "fade" | "slide" | "none";

export type LogoPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type FooterPosition = "bottom-left" | "bottom-center" | "bottom-right";

export type VerticalAlign = "top" | "center";

export interface SlideFrontmatter {
  type: SlideType;
  transition?: TransitionType;
  notes?: string;
  background?: string;
  verticalAlign?: VerticalAlign;
  /**
   * Per-slide logo override. Merged over the deck-level `logo` config for this
   * slide only (e.g. show a corporate logo on a company-overview slide while
   * the rest of the deck keeps the product logo). `src` is required; other
   * fields fall back to the deck config.
   */
  logo?: {
    src: string;
    position?: LogoPosition;
    height?: string;
    offset?: { top?: string; right?: string; bottom?: string; left?: string };
  };
}

export interface ThemeColors {
  primary: string;
  secondary?: string;
  accent?: string;
  headingGradient?: string;
  background?: string;
  text?: string;
  textMuted?: string;
  textSubtle?: string;
  surface?: string;
  surfaceAlt?: string;
  border?: string;
  borderLight?: string;
}

export interface ThemeTypography {
  heading?: string;
  body?: string;
  mono?: string;
  headingWeight?: number;
  headingLetterSpacing?: string;
  bodyLineHeight?: number;
  scale?: number;
}

export interface ThemeSpacing {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  xxl?: number;
  scale?: number;
}

export interface DeckTheme {
  colors: ThemeColors;
  fonts?: ThemeTypography;
  spacing?: ThemeSpacing;
  radius?: string;
}

export interface DeckConfig {
  title: string;
  /** Deck creation date as an ISO date string (e.g. "2026-06-02"). Used for "newest first" sorting on the deck list. */
  createdAt: string;
  overlay?: {
    textColor?: string;
    textColorDark?: string;
  };
  logo?: {
    src: string;
    position: LogoPosition;
    height?: string;
    offset?: { top?: string; right?: string; bottom?: string; left?: string };
  };
  copyright?: {
    text: string;
    position: FooterPosition;
  };
  pageNumber?: {
    position: FooterPosition;
    startFrom?: number;
    hideOnCover?: boolean;
  };
  theme: DeckTheme;
  accentLine?: {
    position: "left" | "right";
    width?: number;
    gradient?: string;
  };
  layoutPadding?: Partial<Record<SlideType, string>>;
  transition?: TransitionType;
}

/**
 * Reusable theme/branding preset shared by several decks. Everything is
 * optional; deck-specific fields (`title`, `createdAt`) are excluded.
 * Presets can themselves extend another preset.
 */
export type DeckPreset = Omit<Partial<DeckConfig>, "title" | "createdAt"> & {
  extends?: DeckPreset;
};

/**
 * What `defineConfig()` accepts: a full DeckConfig, or a partial one that
 * `extends` a preset. `title` and `createdAt` always belong to the deck.
 */
export type DeckConfigInput = Partial<Omit<DeckConfig, "title" | "createdAt">> & {
  title: string;
  createdAt: string;
  extends?: DeckPreset;
};

export interface SlideData {
  index: number;
  filename: string;
  frontmatter: SlideFrontmatter;
  rawContent: string;
  notes?: string;
  /**
   * 1-based line in the .mdx file where `rawContent` begins (i.e. the number
   * of lines consumed by the YAML frontmatter block). Lets tooling map MDX
   * body positions back to file lines.
   */
  contentStartLine: number;
}

export interface DeckSummary {
  name: string;
  title: string;
  slideCount: number;
  /** ISO date string from deck.config.ts `createdAt`. Undefined when the config omits or has an invalid value. */
  createdAt?: string;
}

export interface Deck {
  name: string;
  config: DeckConfig;
  slides: SlideData[];
}
