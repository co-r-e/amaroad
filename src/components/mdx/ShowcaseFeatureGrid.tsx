import type { CSSProperties } from "react";
import { Icon } from "./Icon";
import styles from "./ShowcaseFeatureGrid.module.css";

interface FeatureItem {
  icon?: string;
  title: string;
  description?: string;
}

interface ShowcaseFeatureGridProps {
  variant?: "cards" | "bordered" | "dark" | "horizontal";
  columns?: number;
  items: FeatureItem[];
  style?: CSSProperties;
}

export function ShowcaseFeatureGrid({
  variant = "cards",
  columns = 3,
  items,
  style,
}: ShowcaseFeatureGridProps) {
  if (variant === "horizontal") {
    return (
      <div data-growable="" className={styles.horizontal} style={style}>
        {items.map((item, i) => (
          <div key={i} className={styles.item}>
            {item.icon ? (
              <div className={styles.iconBox}>
                <Icon name={item.icon} size={40} color="var(--slide-text)" />
              </div>
            ) : null}
            <p className={styles.itemTitle}>{item.title}</p>
            {item.description ? (
              <p className={styles.itemDescription}>{item.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  const variantClass =
    variant === "bordered"
      ? styles.bordered
      : variant === "dark"
        ? styles.dark
        : "";

  const iconSize = 56;
  const iconColor =
    variant === "dark" ? "#ffffff" : "var(--slide-text)";

  return (
    <div
      data-growable=""
      className={`${styles.root} ${variantClass}`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, ...style }}
    >
      {items.map((item, i) => (
        <div key={i} className={styles.item}>
          {item.icon ? (
            <div className={styles.itemIcon}>
              <Icon name={item.icon} size={iconSize} color={iconColor} />
            </div>
          ) : null}
          <p className={styles.itemTitle}>{item.title}</p>
          {item.description ? (
            <p className={styles.itemDescription}>{item.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
