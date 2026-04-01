import type { CSSProperties } from "react";
import styles from "./ShowcaseTimeline.module.css";

interface TimelineEntry {
  date: string;
  title: string;
  description?: string;
  color?: string;
  active?: boolean;
}

interface ShowcaseTimelineProps {
  title: string;
  subtitle?: string;
  items: TimelineEntry[];
  orientation?: "horizontal" | "vertical";
  style?: CSSProperties;
}

export function ShowcaseTimeline({
  title,
  subtitle,
  items,
  orientation = "horizontal",
  style,
}: ShowcaseTimelineProps) {
  if (orientation === "vertical") {
    return (
      <div className={styles.wrapper} style={style}>
        <div className={styles.header}>
          <p className={styles.title}>{title}</p>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        <div data-growable="" className={styles.vertical}>
          <div className={styles.verticalLine} />
          {items.map((item, i) => (
            <div key={i} className={styles.verticalItem}>
              <div
                className={
                  item.active ? styles.dotActive : styles.dot
                }
                style={
                  item.color
                    ? { background: item.color, borderColor: item.color }
                    : undefined
                }
              />
              <div className={styles.verticalContent}>
                <p className={styles.date}>{item.date}</p>
                <p className={styles.itemTitle}>{item.title}</p>
                {item.description ? (
                  <p className={styles.itemDescription}>{item.description}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} style={style}>
      <div className={styles.header}>
        <p className={styles.title}>{title}</p>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      <div data-growable="" className={styles.horizontal}>
        <div className={styles.lineRow}>
          <div className={styles.horizontalLine} />
          {items.map((item, i) => (
            <div key={i} className={styles.dotWrapper}>
              <div
                className={
                  item.active ? styles.dotActive : styles.dot
                }
                style={
                  item.color
                    ? { background: item.color, borderColor: item.color }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
        <div className={styles.labelsRow}>
          {items.map((item, i) => (
            <div key={i} className={styles.horizontalItem}>
              <p className={styles.date}>{item.date}</p>
              <p className={styles.itemTitle}>{item.title}</p>
              {item.description ? (
                <p className={styles.itemDescription}>{item.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
