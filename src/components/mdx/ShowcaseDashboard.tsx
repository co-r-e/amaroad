import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./ShowcaseDashboard.module.css";

interface DashboardMetric {
  icon?: string;
  value: string;
  label: string;
}

interface ShowcaseDashboardProps {
  metrics: DashboardMetric[];
  children?: ReactNode;
}

export function ShowcaseDashboard({
  metrics,
  children,
}: ShowcaseDashboardProps) {
  const colCount = metrics.length || 4;

  return (
    <div className={styles.root}>
      <div
        className={styles.metricGrid}
        style={{
          gridTemplateColumns: `repeat(${colCount}, 1fr)`,
        }}
      >
        {metrics.map((m, i) => (
          <div key={i} className={styles.metricCard}>
            {m.icon ? (
              <Icon name={m.icon} size={48} color="var(--slide-primary)" />
            ) : null}
            <p className={styles.metricValue}>{m.value}</p>
            <p className={styles.metricLabel}>{m.label}</p>
          </div>
        ))}
      </div>
      {children ? (
        <div className={styles.childrenArea} data-growable="">
          {children}
        </div>
      ) : null}
    </div>
  );
}
