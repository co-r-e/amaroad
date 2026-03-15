import type { CSSProperties, ReactNode } from "react";
import styles from "./SummaryBanner.module.css";

interface SummaryBannerProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function SummaryBanner({ children, style }: SummaryBannerProps) {
  return (
    <div className={styles.banner} style={style}>
      <span className={styles.text}>{children}</span>
    </div>
  );
}
