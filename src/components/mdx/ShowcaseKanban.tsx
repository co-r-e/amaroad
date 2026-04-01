import type { CSSProperties } from "react";
import styles from "./ShowcaseKanban.module.css";

interface KanbanCard {
  title: string;
  description?: string;
  tag?: string;
}

interface KanbanColumn {
  label: string;
  color?: string;
  items: KanbanCard[];
}

interface ShowcaseKanbanProps {
  title: string;
  subtitle?: string;
  columns: KanbanColumn[];
  style?: CSSProperties;
}

export function ShowcaseKanban({
  title,
  subtitle,
  columns,
  style,
}: ShowcaseKanbanProps) {
  return (
    <div className={styles.wrapper} style={style}>
      <div className={styles.header}>
        <p className={styles.title}>{title}</p>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      <div data-growable="" className={styles.board}>
        {columns.map((col, i) => (
          <div key={i} className={styles.column}>
            <div className={styles.columnHeader}>
              <div
                className={styles.columnDot}
                style={
                  col.color ? { background: col.color } : undefined
                }
              />
              <p className={styles.columnLabel}>{col.label}</p>
              <span className={styles.columnCount}>{col.items.length}</span>
            </div>
            <div className={styles.cardList}>
              {col.items.map((card, j) => (
                <div key={j} className={styles.card}>
                  <p className={styles.cardTitle}>{card.title}</p>
                  {card.description ? (
                    <p className={styles.cardDescription}>
                      {card.description}
                    </p>
                  ) : null}
                  {card.tag ? (
                    <span
                      className={styles.cardTag}
                      style={
                        col.color
                          ? {
                              background: `color-mix(in srgb, ${col.color} 12%, transparent)`,
                              color: col.color,
                            }
                          : undefined
                      }
                    >
                      {card.tag}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
