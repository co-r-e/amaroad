import type { ReactNode, CSSProperties } from "react";
import styles from "./Grid.module.css";

interface GridProps {
  children: ReactNode;
  columns?: number | string;
  gap?: string;
  align?: "start" | "center" | "end" | "stretch";
  style?: CSSProperties;
}

const alignMap: Record<string, string> = {
  start: "start",
  center: "center",
  end: "end",
  stretch: "stretch",
};

export function Grid({
  children,
  columns = 2,
  gap,
  align,
  style,
}: GridProps) {
  const template =
    typeof columns === "number" ? `repeat(${columns}, 1fr)` : columns;

  const inlineStyle: CSSProperties = {
    gridTemplateColumns: template,
    ...style,
  };
  if (gap) inlineStyle.gap = gap;
  if (align) inlineStyle.alignItems = alignMap[align];

  return (
    <div data-growable="" className={styles.grid} style={inlineStyle}>
      {children}
    </div>
  );
}
