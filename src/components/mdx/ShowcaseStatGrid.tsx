import { Stat } from "./Stat";
import styles from "./ShowcaseStatGrid.module.css";

interface StatItem {
  value: string;
  label: string;
  trend?: "up" | "down";
}

interface ShowcaseStatGridProps {
  items: StatItem[];
  columns?: 2 | 3 | 4;
}

export function ShowcaseStatGrid({ items, columns = 3 }: ShowcaseStatGridProps) {
  return (
    <div
      data-growable=""
      className={styles.root}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {items.map((item, i) => (
        <Stat key={i} value={item.value} label={item.label} trend={item.trend} size="lg" />
      ))}
    </div>
  );
}
