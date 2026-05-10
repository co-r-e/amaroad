import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./ShowcaseSplit.module.css";

interface SplitCard {
  title: string;
  description: string;
}

interface ShowcaseSplitProps {
  variant?: "speaker" | "dark-light" | "spotlight" | "data-narrative";
  name?: string;
  role?: string;
  bio?: string;
  details?: string[];
  src?: string;
  imageLabel?: string;
  leftTitle?: string;
  leftItems?: string[];
  rightMetrics?: { value: string; label: string }[];
  value?: string;
  label?: string;
  description?: string;
  cards?: SplitCard[];
  children?: ReactNode;
}

function SpeakerVariant({
  name,
  role,
  bio,
  details = [],
  src,
  imageLabel,
}: {
  name?: string;
  role?: string;
  bio?: string;
  details?: string[];
  src?: string;
  imageLabel?: string;
}) {
  return (
    <div className={styles.speaker}>
      <div className={styles.speakerImageCol}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.speakerImage}
            src={src}
            alt={imageLabel ?? name ?? ""}
          />
        ) : (
          <div className={styles.speakerPlaceholder}>
            <Icon
              name="user"
              size={120}
              color="var(--slide-text-subtle)"
            />
          </div>
        )}
      </div>
      <div className={styles.speakerBio}>
        <div>
          {name ? <p className={styles.speakerName}>{name}</p> : null}
          {role ? <p className={styles.speakerRole}>{role}</p> : null}
        </div>
        <div className={styles.speakerDivider} />
        {bio ? <p className={styles.speakerBioText}>{bio}</p> : null}
        {details.length > 0 ? (
          <div className={styles.speakerDetails}>
            {details.map((d, i) => (
              <p key={i} className={styles.speakerDetail}>
                {d}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DarkLightVariant({
  leftTitle,
  leftItems = [],
  rightMetrics = [],
  description,
}: {
  leftTitle?: string;
  leftItems?: string[];
  rightMetrics?: { value: string; label: string }[];
  description?: string;
}) {
  return (
    <div className={styles.darkLight}>
      <div className={styles.darkPanel}>
        {leftItems.length > 0 && leftItems[0] ? (
          <p className={styles.darkPanelKicker}>{leftItems[0]}</p>
        ) : null}
        {leftTitle ? (
          <p className={styles.darkPanelTitle}>{leftTitle}</p>
        ) : null}
        {description ? (
          <p className={styles.darkPanelBody}>{description}</p>
        ) : null}
        {leftItems.length > 1 ? (
          <div className={styles.darkPanelItems}>
            {leftItems.slice(1).map((item, i) => (
              <div key={i} className={styles.darkPanelItem}>
                <Icon name="check-circle" size={24} color="#CCC" />
                <p className={styles.darkPanelItemText}>{item}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.lightPanel}>
        {rightMetrics.map((m, i) => (
          <div key={i} className={styles.metricBlock}>
            <p className={styles.metricValue}>{m.value}</p>
            <p className={styles.metricLabel}>{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpotlightVariant({
  value,
  label,
  description,
  cards = [],
}: {
  value?: string;
  label?: string;
  description?: string;
  cards?: SplitCard[];
}) {
  return (
    <div className={styles.spotlight} data-growable="">
      <div className={styles.spotlightLeft}>
        {value ? <p className={styles.spotlightValue}>{value}</p> : null}
        {label ? <p className={styles.spotlightLabel}>{label}</p> : null}
        {description ? (
          <p className={styles.spotlightDescription}>{description}</p>
        ) : null}
      </div>
      <div className={styles.spotlightRight}>
        {cards.map((card, i) => (
          <div key={i} className={styles.spotlightCard}>
            <p className={styles.spotlightCardTitle}>{card.title}</p>
            <p className={styles.spotlightCardDesc}>{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataNarrativeVariant({
  value,
  label,
  description,
  children,
}: {
  value?: string;
  label?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.dataNarrative}>
      <div className={styles.dataNarrativeLeft}>
        {value ? <p className={styles.dataNarrativeValue}>{value}</p> : null}
        {label ? <p className={styles.dataNarrativeLabel}>{label}</p> : null}
        {description ? (
          <p className={styles.dataNarrativeDesc}>{description}</p>
        ) : null}
      </div>
      <div className={styles.dataNarrativeRight} data-growable="">
        {children}
      </div>
    </div>
  );
}

export function ShowcaseSplit({
  variant = "speaker",
  name,
  role,
  bio,
  details,
  src,
  imageLabel,
  leftTitle,
  leftItems,
  rightMetrics,
  value,
  label,
  description,
  cards,
  children,
}: ShowcaseSplitProps) {
  if (variant === "speaker") {
    return (
      <SpeakerVariant
        name={name}
        role={role}
        bio={bio}
        details={details}
        src={src}
        imageLabel={imageLabel}
      />
    );
  }

  if (variant === "dark-light") {
    return (
      <DarkLightVariant
        leftTitle={leftTitle}
        leftItems={leftItems}
        rightMetrics={rightMetrics}
        description={description}
      />
    );
  }

  if (variant === "spotlight") {
    return (
      <SpotlightVariant
        value={value}
        label={label}
        description={description}
        cards={cards}
      />
    );
  }

  return (
    <DataNarrativeVariant
      value={value}
      label={label}
      description={description}
    >
      {children}
    </DataNarrativeVariant>
  );
}
