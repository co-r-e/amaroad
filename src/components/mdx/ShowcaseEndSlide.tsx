import { Icon } from "./Icon";
import styles from "./ShowcaseEndSlide.module.css";

interface ButtonDef {
  label: string;
  filled?: boolean;
}
interface IconDef {
  name: string;
  label?: string;
}

interface ShowcaseEndSlideProps {
  variant?:
    | "dark-keywords"
    | "cta"
    | "hero"
    | "section-icons"
    | "contact"
    | "thank-you";
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  description?: string;
  keywords?: string[];
  buttons?: ButtonDef[];
  icons?: IconDef[];
  contactLines?: string[];
  link?: string;
}

function IconCircle({
  name,
  color,
  size,
  iconSize,
}: {
  name: string;
  color: string;
  size: number;
  iconSize: number;
}) {
  return (
    <div
      className={styles.iconCircle}
      style={{ width: size, height: size, background: color }}
    >
      <Icon name={name} size={iconSize} color="#FFF" />
    </div>
  );
}

function ButtonRow({ buttons }: { buttons: ButtonDef[] }) {
  return (
    <div className={styles.buttonRow}>
      {buttons.map((btn, i) => (
        <div
          key={i}
          className={btn.filled ? styles.btnFilled : styles.btnOutline}
        >
          {btn.label}
        </div>
      ))}
    </div>
  );
}

function IconRowSection({ icons }: { icons: IconDef[] }) {
  return (
    <div className={styles.iconRow}>
      {icons.map((ic, i) => (
        <div key={i} className={styles.iconItem}>
          <Icon name={ic.name} size={36} color="var(--slide-text)" />
          {ic.label ? <p className={styles.iconLabel}>{ic.label}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function ShowcaseEndSlide({
  variant = "cta",
  icon,
  iconColor = "var(--slide-primary)",
  title,
  subtitle,
  description,
  keywords = [],
  buttons = [],
  icons = [],
  contactLines = [],
  link,
}: ShowcaseEndSlideProps) {
  if (variant === "dark-keywords") {
    return (
      <div className={styles.centered}>
        <p className={styles.darkTitle}>{title}</p>
        {description ? (
          <p className={styles.darkDescription}>{description}</p>
        ) : null}
        {keywords.length > 0 ? (
          <div className={styles.keywordRow}>
            {keywords.map((kw, i) => (
              <span key={i} className={styles.keyword}>
                {kw}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === "cta") {
    return (
      <div className={styles.centered}>
        <p className={styles.ctaTitle}>{title}</p>
        {description ? (
          <p className={styles.ctaDescription}>{description}</p>
        ) : null}
        {buttons.length > 0 ? <ButtonRow buttons={buttons} /> : null}
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div className={styles.centered}>
        {icon ? (
          <IconCircle name={icon} color={iconColor} size={80} iconSize={40} />
        ) : null}
        <p className={styles.heroTitle}>{title}</p>
        {subtitle ? <p className={styles.heroSubtitle}>{subtitle}</p> : null}
        {buttons.length > 0 ? <ButtonRow buttons={buttons} /> : null}
      </div>
    );
  }

  if (variant === "section-icons") {
    return (
      <div className={styles.centered}>
        {icon ? (
          <IconCircle name={icon} color={iconColor} size={96} iconSize={48} />
        ) : null}
        <p className={styles.sectionTitle}>{title}</p>
        {description ? (
          <p className={styles.sectionDescription}>{description}</p>
        ) : null}
        {icons.length > 0 ? <IconRowSection icons={icons} /> : null}
      </div>
    );
  }

  if (variant === "contact") {
    return (
      <div className={styles.centered} style={{ height: "100%" }}>
        <p className={styles.contactTitle}>{title}</p>
        <div className={styles.contactDivider} />
        {contactLines.length > 0 ? (
          <div className={styles.contactLines}>
            {contactLines.map((line, i) => (
              <p key={i} className={styles.contactLine}>
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  /* thank-you */
  return (
    <div className={styles.centered}>
      {icon ? (
        <IconCircle name={icon} color={iconColor} size={96} iconSize={48} />
      ) : null}
      <p className={styles.thankTitle}>{title}</p>
      {subtitle ? <p className={styles.thankSubtitle}>{subtitle}</p> : null}
      {icons.length > 0 ? <IconRowSection icons={icons} /> : null}
      {link ? <p className={styles.thankLink}>{link}</p> : null}
    </div>
  );
}
