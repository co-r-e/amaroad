import type { CSSProperties } from "react";
import styles from "./ShowcaseRoadmap.module.css";

interface RoadmapPhase {
  label: string;
  items: string[];
  color?: string;
  status?: "done" | "active" | "upcoming";
}

interface ShowcaseRoadmapProps {
  title: string;
  subtitle?: string;
  phases: RoadmapPhase[];
  style?: CSSProperties;
}

export function ShowcaseRoadmap({
  title,
  subtitle,
  phases,
  style,
}: ShowcaseRoadmapProps) {
  const getStatusClass = (status?: string) => {
    switch (status) {
      case "done":
        return styles.phaseDone;
      case "active":
        return styles.phaseActive;
      default:
        return styles.phaseUpcoming;
    }
  };

  const getHeaderClass = (status?: string) => {
    switch (status) {
      case "done":
        return styles.phaseHeaderDone;
      case "active":
        return styles.phaseHeaderActive;
      default:
        return styles.phaseHeaderUpcoming;
    }
  };

  return (
    <div className={styles.wrapper} style={style}>
      <div className={styles.header}>
        <p className={styles.title}>{title}</p>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      <div data-growable="" className={styles.phasesRow}>
        <div className={styles.progressBar}>
          {phases.map((phase, i) => (
            <div
              key={i}
              className={
                phase.status === "done"
                  ? styles.progressSegmentDone
                  : phase.status === "active"
                    ? styles.progressSegmentActive
                    : styles.progressSegmentUpcoming
              }
              style={phase.color && phase.status !== "upcoming" ? { background: phase.color } : undefined}
            />
          ))}
        </div>
        <div className={styles.columns}>
          {phases.map((phase, i) => (
            <div key={i} className={getStatusClass(phase.status)}>
              <div
                className={getHeaderClass(phase.status)}
                style={
                  phase.color && phase.status === "active"
                    ? { color: phase.color }
                    : undefined
                }
              >
                <p className={styles.phaseLabel}>{phase.label}</p>
              </div>
              <div className={styles.phaseItems}>
                {phase.items.map((item, j) => (
                  <div key={j} className={styles.phaseItem}>
                    <p className={styles.phaseItemText}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
