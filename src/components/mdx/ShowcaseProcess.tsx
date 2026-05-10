import type { CSSProperties } from "react";
import { Icon } from "./Icon";
import styles from "./ShowcaseProcess.module.css";

interface ProcessStep {
  title: string;
  description?: string;
  icon?: string;
}

interface ShowcaseProcessProps {
  title: string;
  subtitle?: string;
  steps: ProcessStep[];
  style?: CSSProperties;
}

export function ShowcaseProcess({
  title,
  subtitle,
  steps,
  style,
}: ShowcaseProcessProps) {
  return (
    <div className={styles.wrapper} style={style}>
      <div className={styles.header}>
        <p className={styles.title}>{title}</p>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      <div data-growable="" className={styles.stepsRow}>
        {steps.map((step, i) => (
          <div key={i} className={styles.stepGroup}>
            <div className={styles.card}>
              <div className={styles.numberCircle}>
                {step.icon ? (
                  <Icon
                    name={step.icon}
                    size={24}
                    color="var(--slide-primary)"
                  />
                ) : (
                  <span className={styles.numberText}>{i + 1}</span>
                )}
              </div>
              <p className={styles.stepTitle}>{step.title}</p>
              {step.description ? (
                <p className={styles.stepDescription}>{step.description}</p>
              ) : null}
            </div>
            {i < steps.length - 1 ? (
              <div className={styles.arrowWrapper}>
                <div className={styles.arrow} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
