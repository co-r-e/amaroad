import { Icon } from "./Icon";
import styles from "./ShowcaseIconGrid.module.css";

interface IconItem {
  name: string;
  label?: string;
}

interface ShowcaseIconGridProps {
  items: IconItem[];
  columns?: number;
  rows?: number;
  iconSize?: number;
}

export function ShowcaseIconGrid({
  items,
  columns = 5,
  rows,
  iconSize = 48,
}: ShowcaseIconGridProps) {
  return (
    <div
      data-growable=""
      className={styles.root}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        ...(rows ? { gridTemplateRows: `repeat(${rows}, 1fr)` } : {}),
      }}
    >
      {items.map((item, i) => (
        <div key={i} className={styles.cell}>
          <Icon name={item.name} size={iconSize} color="var(--slide-text)" />
          {item.label ? (
            <span className={styles.label}>{item.label}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
