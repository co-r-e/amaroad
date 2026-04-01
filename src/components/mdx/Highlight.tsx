import type { CSSProperties, ReactNode } from "react";
import styles from "./Highlight.module.css";

interface HighlightProps {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

export function Highlight({ children, color, style }: HighlightProps) {
  const highlightColor = color ?? "var(--slide-primary)";

  return (
    <span
      className={styles.highlight}
      style={{
        "--highlight-bg": `color-mix(in srgb, ${highlightColor} 20%, transparent)`,
        ...style,
      } as CSSProperties}
    >
      {children}
    </span>
  );
}
