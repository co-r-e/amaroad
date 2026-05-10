import { cn } from "@/lib/utils";
import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  value: number;
  label?: string;
  color?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}

export function ProgressBar({
  value,
  label,
  color,
  showValue = true,
  size = "md",
  style,
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={styles.root} style={style}>
      {(label || showValue) && (
        <div className={styles.header}>
          {label && <span className={styles.label}>{label}</span>}
          {showValue && (
            <span
              className={styles.percentage}
              style={{ color: color ?? "var(--slide-primary)" }}
            >
              {clampedValue}%
            </span>
          )}
        </div>
      )}
      <div className={cn(styles.track, styles[size])}>
        <div
          className={styles.fill}
          style={{
            width: `${clampedValue}%`,
            background: color ?? "var(--slide-primary)",
          }}
        />
      </div>
    </div>
  );
}
