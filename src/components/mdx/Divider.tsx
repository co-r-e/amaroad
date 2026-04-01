import type { CSSProperties } from "react";
import styles from "./Divider.module.css";

interface DividerProps {
  label?: string;
  color?: string;
  style?: CSSProperties;
}

export function Divider({ label, color, style }: DividerProps) {
  const dividerStyle: CSSProperties = {
    ...(color ? { "--divider-color": color } as CSSProperties : {}),
    ...style,
  };

  if (!label) {
    return (
      <div className={styles.line} style={dividerStyle} />
    );
  }

  return (
    <div className={styles.divider} style={dividerStyle}>
      <div className={styles.line} />
      <span className={styles.label}>{label}</span>
      <div className={styles.line} />
    </div>
  );
}
