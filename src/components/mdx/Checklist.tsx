import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Checklist.module.css";

interface ChecklistProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function Checklist({ children, style }: ChecklistProps) {
  return (
    <div className={styles.checklist} style={style}>
      {children}
    </div>
  );
}

interface CheckItemProps {
  children: ReactNode;
  checked?: boolean;
  style?: CSSProperties;
}

export function CheckItem({
  children,
  checked = true,
  style,
}: CheckItemProps) {
  return (
    <div className={styles.item} style={style}>
      <span
        className={cn(styles.icon, checked ? styles.checked : styles.unchecked)}
      >
        {checked ? "\u2713" : "\u2717"}
      </span>
      <span className={styles.text}>{children}</span>
    </div>
  );
}
