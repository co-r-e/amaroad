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
}

export interface ThemeSpacing {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  xxl?: number;
}

export interface DeckTheme {
  colors: ThemeColors;
  fonts?: ThemeTypography;
  spacing?: ThemeSpacing;
  radius?: string;
}

export interface DeckConfig {
  title: string;
  logo?: {
    src: string;
    position: LogoPosition;
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
  transition?: TransitionType;
}

export interface SlideData {
  index: number;
  filename: string;
  frontmatter: SlideFrontmatter;
  rawContent: string;
  notes?: string;
}

export interface DeckSummary {
  name: string;
  title: string;
  slideCount: number;
}

export interface Deck {
  name: string;
  config: DeckConfig;
  slides: SlideData[];
}
