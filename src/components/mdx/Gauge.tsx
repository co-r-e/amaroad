import styles from "./Gauge.module.css";

interface GaugeProps {
  value: number;
  label?: string;
  size?: number;
  color?: string;
  thickness?: number;
  style?: React.CSSProperties;
}

export function Gauge({
  value,
  label,
  size = 12,
  color,
  thickness = 12,
  style,
}: GaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const accentColor = color ?? "var(--slide-primary)";

  const radius = 60 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 270 / 360;
  const arcLength = circumference * arcFraction;
  const offset = arcLength * (1 - clampedValue / 100);

  // Rotate so the gap is at the bottom center
  // 270-degree arc starting from bottom-left: rotate 135 degrees
  const rotation = 135;

  return (
    <div
      className={styles.root}
      style={{ width: `${size}rem`, height: `${size}rem`, ...style }}
    >
      <svg viewBox="0 0 120 120" className={styles.svg}>
        {/* Background track */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--slide-border)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(${rotation} 60 60)`}
        />
        {/* Progress arc */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(${rotation} 60 60)`}
        />
      </svg>
      <div className={styles.center}>
        <span className={styles.value} style={{ color: accentColor }}>
          {clampedValue}%
        </span>
        {label && <span className={styles.label}>{label}</span>}
      </div>
    </div>
  );
}
