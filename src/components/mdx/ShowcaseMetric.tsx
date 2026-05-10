import styles from "./ShowcaseMetric.module.css";

interface ShowcaseMetricProps {
  value: string;
  label?: string;
  description?: string;
}

export function ShowcaseMetric({
  value,
  label,
  description,
}: ShowcaseMetricProps) {
  return (
    <div data-growable="" className={styles.root}>
      {label ? <p className={styles.label}>{label}</p> : null}
      <p className={styles.value}>{value}</p>
      {description ? (
        <p className={styles.description}>{description}</p>
      ) : null}
    </div>
  );
}
