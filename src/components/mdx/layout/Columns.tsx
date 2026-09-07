import type { ReactNode } from "react";
import styles from "./Columns.module.css";

interface ColumnsProps {
  children: ReactNode;
  gap?: string;
}

export function Columns({ children, gap }: ColumnsProps) {
  return (
    <div data-growable="" className={styles.columns} style={gap ? { gap } : undefined}>
      {children}
    </div>
  );
}

interface ColumnProps {
  children: ReactNode;
  width?: string;
}

export function Column({ children, width }: ColumnProps) {
  return (
    <div
      data-column=""
      className={styles.column}
      // flex-shrink stays 1 so widths that sum to 100% still fit once the
      // Columns gap is accounted for (e.g. 30% + 70% + gap).
      style={width ? { flex: `0 1 ${width}` } : undefined}
    >
      {children}
    </div>
  );
}
