import type { CSSProperties, ReactNode } from "react";
import styles from "./Pill.module.css";

interface PillProps {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

export function Pill({ children, color, style }: PillProps) {
  const pillColor = color ?? "var(--slide-primary)";

  return (
    <span
      className={styles.pill}
      style={{
        "--pill-color": pillColor,
        "--pill-bg": `color-mix(in srgb, ${pillColor} 15%, transparent)`,
        ...style,
      } as CSSProperties}
    >
      {children}
    </span>
  );
}

interface PillGroupProps {
  children: ReactNode;
  gap?: string;
  style?: CSSProperties;
}

export function PillGroup({ children, gap, style }: PillGroupProps) {
  return (
    <div
      className={styles.group}
      style={{
        ...(gap ? { "--pill-gap": gap } as CSSProperties : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
