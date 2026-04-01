import type { CSSProperties, ReactNode } from "react";
import styles from "./Callout.module.css";

type CalloutType = "info" | "warning" | "success" | "tip";

interface CalloutProps {
  children: ReactNode;
  type?: CalloutType;
  title?: string;
  style?: CSSProperties;
}

const typeLabels: Record<CalloutType, string> = {
  info: "INFO",
  warning: "WARNING",
  success: "SUCCESS",
  tip: "TIP",
};

function getCalloutColors(type: CalloutType): { color: string; bg: string } {
  switch (type) {
    case "info":
      return { color: "var(--slide-primary)", bg: "color-mix(in srgb, var(--slide-primary) 8%, transparent)" };
    case "warning":
      return { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" };
    case "success":
      return { color: "#10b981", bg: "rgba(16, 185, 129, 0.08)" };
    case "tip":
      return { color: "var(--slide-accent)", bg: "color-mix(in srgb, var(--slide-accent) 8%, transparent)" };
  }
}

export function Callout({
  children,
  type = "info",
  title,
  style,
}: CalloutProps) {
  const colors = getCalloutColors(type);

  return (
    <div
      className={styles.callout}
      style={{
        "--callout-bg": colors.bg,
        "--callout-color": colors.color,
        ...style,
      } as CSSProperties}
    >
      <span className={styles.label}>{typeLabels[type]}</span>
      {title && <p className={styles.title}>{title}</p>}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
