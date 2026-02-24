import type { CSSProperties } from "react";
import type { DeckConfig, SlideFrontmatter } from "@/types/deck";

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

const DEFAULT_BACKGROUND = "#FFFFFF";

export function resolveSlideBackground(
  frontmatter: SlideFrontmatter,
  config: DeckConfig,
): string {
  return (
    frontmatter.background ?? config.theme.colors.background ?? DEFAULT_BACKGROUND
  );
}

/** Build inline styles for a slide container that scales to fit its parent. */
export function buildScaledSlideStyle(
  scale: number | null,
  background: string,
): CSSProperties {
  return {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    background,
    transform: scale != null ? `scale(${scale})` : undefined,
    opacity: scale != null ? 1 : 0,
    flexShrink: 0,
  };
}
