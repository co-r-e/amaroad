import type { ReactNode, CSSProperties } from "react";
import styles from "./Stack.module.css";

interface StackProps {
  children: ReactNode;
  direction?: "vertical" | "horizontal";
  gap?: string;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
  wrap?: boolean;
  style?: CSSProperties;
}

const alignMap: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

const justifyMap: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

export function Stack({
  children,
  direction = "vertical",
  gap,
  align,
  justify,
  wrap,
  style,
}: StackProps) {
  const isVertical = direction === "vertical";
  const className = isVertical ? styles.vertical : styles.horizontal;

  const inlineStyle: CSSProperties = { ...style };
  if (gap) inlineStyle.gap = gap;
  if (align) inlineStyle.alignItems = alignMap[align];
  if (justify) inlineStyle.justifyContent = justifyMap[justify];
  if (wrap) inlineStyle.flexWrap = "wrap";

  return (
    <div
      {...(isVertical ? { "data-growable": "" } : {})}
      className={className}
      style={Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined}
    >
      {children}
    </div>
  );
}
