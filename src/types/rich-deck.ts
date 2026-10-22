/** HTML decks own their layout, fonts, branding, and animation. */
export interface RichDeckConfig {
  format: "html";
  title: string;
  createdAt: string;
  /** Entry HTML and all assets are embedded; enables a standalone HTML download. */
  standalone?: boolean;
}

export interface RichDeckSummary {
  name: string;
  title: string;
  createdAt: string;
  format: "html";
}

export interface RichDeck {
  name: string;
  config: RichDeckConfig;
}

/** Zero-based indices, including the current reveal step within a slide. */
export interface RichDeckState {
  slideIndex: number;
  stepIndex: number;
  slideCount: number;
  stepCount: number;
}

export interface RichDeckSlide {
  title: string;
  notes?: string;
}

export interface RichDeckPosition {
  slideIndex: number;
  stepIndex: number;
}

export interface RichDeckCapabilities {
  next: boolean;
  previous: boolean;
  goTo: boolean;
}

export type RichDeckCommand =
  | { action: "next" | "previous" }
  | { action: "goTo"; slideIndex: number; stepIndex: number };
