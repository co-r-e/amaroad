import styles from "./ShowcaseSection.module.css";

type ShowcaseSectionVariant = "left" | "number" | "dark" | "split" | "minimal" | "centered";

interface ShowcaseSectionProps {
  title: string;
  description?: string;
  section?: string;
  chips?: string[];
  variant?: ShowcaseSectionVariant;
}

function ChipRow({
  chips,
  dark = false,
}: {
  chips: string[];
  dark?: boolean;
}) {
  if (!chips.length) return null;

  return (
    <div className={styles.chips}>
      {chips.map((chip) => (
        <span key={chip} className={dark ? styles.darkChip : styles.chip}>
          {chip}
        </span>
      ))}
    </div>
  );
}

export function ShowcaseSection({
  title,
  description,
  section,
  chips = [],
  variant = "left",
}: ShowcaseSectionProps) {
  if (variant === "number") {
    return (
      <div className={styles.numberLayout}>
        {section ? <p className={styles.number}>{section}</p> : null}
        <div className={styles.numberCopy}>
          <p className={styles.numberTitle}>{title}</p>
          {description ? <p className={styles.numberDescription}>{description}</p> : null}
          <ChipRow chips={chips} />
        </div>
      </div>
    );
  }

  if (variant === "dark") {
    return (
      <div className={`${styles.breakout} ${styles.dark}`}>
        <div className={styles.darkInner}>
          <p className={styles.darkTitle}>{title}</p>
          {description ? <p className={styles.darkDescription}>{description}</p> : null}
          <ChipRow chips={chips} dark />
        </div>
      </div>
    );
  }

  if (variant === "split") {
    return (
      <div className={styles.breakout}>
        <div className={styles.splitLayout}>
          <div className={styles.splitBand}>
            {section ? <p className={styles.splitNumber}>{section}</p> : null}
          </div>
          <div className={styles.splitCopy}>
            <p className={styles.splitTitle}>{title}</p>
            {description ? <p className={styles.description}>{description}</p> : null}
            <ChipRow chips={chips} />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={styles.stack}>
        <div className={styles.minimalLine} />
        <p className={styles.title}>{title}</p>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div className={styles.centered}>
        <p className={styles.centeredTitle}>{title}</p>
        {description ? <p className={styles.centeredDescription}>{description}</p> : null}
        <ChipRow chips={chips} />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {section ? <p className={styles.label}>{section}</p> : null}
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      <ChipRow chips={chips} />
    </div>
  );
}
