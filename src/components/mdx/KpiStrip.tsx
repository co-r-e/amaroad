import styles from "./KpiStrip.module.css";

interface KpiStripItem {
  value: string;
  label: string;
}

interface KpiStripProps {
  items: KpiStripItem[];
}

export function KpiStrip({ items }: KpiStripProps) {
  return (
    <div data-growable="" className={styles.root}>
      <div className={styles.strip}>
        {items.map((item, index) => (
          <div key={`${item.value}-${item.label}`} style={{ display: "flex", alignItems: "center", gap: "var(--slide-space-xl)" }}>
            <div className={styles.item}>
              <p className={styles.value}>{item.value}</p>
              <p className={styles.label}>{item.label}</p>
            </div>
            {index < items.length - 1 ? <div className={styles.separator} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
