import type { ReactNode } from "react";
import styles from "./ShowcaseShapeGrid.module.css";

interface ShowcaseShapeGridProps {
  children: ReactNode;
}

export function ShowcaseShapeGrid({ children }: ShowcaseShapeGridProps) {
  return (
    <div data-growable="" className={styles.root}>
      {children}
    </div>
  );
}

interface ShapeItemProps {
  label: string;
  children: ReactNode;
}

export function ShapeItem({ label, children }: ShapeItemProps) {
  return (
    <div className={styles.item}>
      {children}
      <p className={styles.label}>{label}</p>
    </div>
  );
}
