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
  /**
   * Read-aloud script for presenter auto-play. Separate from `notes` (which
   * stay presenter-only memos). Audio is generated with `pnpm amaroad narrate`.
   */
  narration?: string;
}

/** Deck-level settings for `narration` audio (Gemini TTS) and auto-play pacing. */
export interface NarrationConfig {
  /** Gemini TTS prebuilt voice name (default "Kore"). */
  voice?: string;
  /** BCP-47 language code such as "ja-JP". Omitted: detected from the text. */
  language?: string;
  /** Delivery direction read by the model, not spoken, e.g. "落ち着いた口調で". */
  style?: string;
  /** Gemini TTS model id (default "gemini-3.8-flash-tts"). */
  model?: string;
  /** Seconds a slide without audio stays up during auto-play (default 5). */
  silentSlideSeconds?: number;
  /** Seconds to wait after a slide's audio ends before advancing (default 1). */
  pauseSeconds?: number;
}

/** One slide's generated narration audio, as handed to the presenter. */
export interface NarrationTrack {
  src: string;
  durationSec: number;
}

/** Everything presenter auto-play needs, resolved on the server. */
export interface PresenterNarration {
  silentSlideSeconds: number;
  pauseSeconds: number;
  /** Indexed like `deck.slides`; null when the slide has no up-to-date audio. */
  tracks: (NarrationTrack | null)[];
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
  narration?: NarrationConfig;
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
