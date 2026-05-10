import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Badge.module.css";

interface BadgeProps {
  children: ReactNode;
  color?: string;
  variant?: "solid" | "outline" | "subtle";
  size?: "sm" | "md";
  style?: CSSProperties;
}

export function Badge({
  children,
  color,
  variant = "subtle",
  size = "md",
  style,
}: BadgeProps) {
  const badgeColor = color ?? "var(--slide-primary)";

  return (
    <span
      className={cn(styles.badge, styles[variant], styles[size])}
      style={{
        "--badge-color": badgeColor,
        "--badge-bg": `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
        ...style,
      } as CSSProperties}
    >
      {children}
    </span>
  );
}
