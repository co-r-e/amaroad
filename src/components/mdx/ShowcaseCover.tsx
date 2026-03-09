import { Icon } from "./Icon";
import styles from "./ShowcaseCover.module.css";

type ShowcaseCoverVariant =
  | "split-band"
  | "image-right"
  | "overlay"
  | "typography"
  | "minimal"
  | "creative"
  | "artistic";

interface ShowcaseCoverProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  description?: string;
  hint?: string;
  meta?: string;
  tags?: string[];
  variant?: ShowcaseCoverVariant;
  imageSrc?: string;
  imageAlt?: string;
  imageLabel?: string;
}

function CoverMedia({
  src,
  alt,
  label = "Image",
}: {
  src?: string;
  alt?: string;
  label?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={styles.coverImage}
        src={src}
        alt={alt ?? ""}
      />
    );
  }

  return (
    <div className={styles.placeholder}>
      <Icon name="image" size={96} color="currentColor" />
      <span className={styles.placeholderLabel}>{label}</span>
    </div>
  );
}

export function ShowcaseCover({
  title,
  subtitle,
  eyebrow,
  description,
  hint,
  meta,
  tags = [],
  variant = "split-band",
  imageSrc,
  imageAlt,
  imageLabel,
}: ShowcaseCoverProps) {
  if (variant === "image-right") {
    return (
      <div className={styles.breakout}>
        <div className={styles.imageRight}>
          <div className={styles.imageRightCopy}>
            {eyebrow ? <p className={styles.kicker}>{eyebrow}</p> : null}
            <p className={styles.heroTitle}>{title}</p>
            {subtitle ? <p className={styles.heroBody}>{subtitle}</p> : null}
          </div>
          <div className={styles.mediaPanel}>
            <CoverMedia src={imageSrc} alt={imageAlt} label={imageLabel} />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div className={styles.breakout}>
        <div className={styles.overlayRoot}>
          <div className={styles.mediaPanel}>
            <CoverMedia src={imageSrc} alt={imageAlt} label={imageLabel} />
          </div>
          <div className={styles.overlayShade} />
          <div className={styles.overlayContent}>
            <p className={styles.overlayTitle}>{title}</p>
            {subtitle ? <p className={styles.overlaySubtitle}>{subtitle}</p> : null}
            {meta ? <p className={styles.overlayMeta}>{meta}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "typography") {
    return (
      <div className={styles.typography}>
        <p className={styles.typographyTitle}>{title}</p>
        {subtitle ? <p className={styles.typographySubtitle}>{subtitle}</p> : null}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={styles.minimal}>
        <div className={styles.minimalAccent} />
        <p className={styles.minimalTitle}>{title}</p>
        {subtitle ? <p className={styles.minimalSubtitle}>{subtitle}</p> : null}
        {meta ? <p className={styles.minimalMeta}>{meta}</p> : null}
      </div>
    );
  }

  if (variant === "creative") {
    const titleLines = title.split("\n");
    return (
      <div className={styles.creative}>
        {/* Decorative circles */}
        <div className={styles.creativeCircleLg} />
        <div className={styles.creativeCircleMd} />
        <div className={styles.creativeCircleGlow} />

        {/* Accent dot cluster */}
        <div className={styles.creativeDotCluster}>
          <div className={styles.creativeDot1} />
          <div className={styles.creativeDot2} />
          <div className={styles.creativeDot3} />
        </div>

        {/* Diagonal accent line */}
        <div className={styles.creativeDiagonalLine} />

        {/* Main content */}
        <div className={styles.creativeContent}>
          {eyebrow ? (
            <div className={styles.creativeEyebrowRow}>
              <div className={styles.creativeEyebrowLine} />
              <p className={styles.creativeEyebrow}>{eyebrow}</p>
              <div className={styles.creativeEyebrowLine} />
            </div>
          ) : null}
          <p className={styles.creativeTitle}>
            {titleLines.map((line, i) => (
              <span key={i}>
                {i > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </p>
          {subtitle ? <p className={styles.creativeSubtitle}>{subtitle}</p> : null}
          {tags.length ? (
            <div className={styles.creativeTagRow}>
              {tags.map((tag) => (
                <span key={tag} className={styles.creativeTag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === "artistic") {
    const titleLines = title.split("\n");
    return (
      <div className={styles.artistic}>
        {/* Background grid pattern (inline SVG for defs/pattern) */}
        <svg className={styles.artisticGrid}>
          <defs>
            <pattern id="artistic-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#fff" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#artistic-grid)" />
        </svg>

        {/* Orbital rings */}
        <div className={styles.artisticOrbitTR1} />
        <div className={styles.artisticOrbitTR2} />
        <div className={styles.artisticOrbitBL} />

        {/* Glowing orbs */}
        <div className={styles.artisticOrbPurple} />
        <div className={styles.artisticOrbOrange} />
        <div className={styles.artisticOrbCyan} />

        {/* Floating diamonds */}
        <div className={styles.artisticDiamond1} />
        <div className={styles.artisticDiamond2} />
        <div className={styles.artisticDiamond3} />

        {/* Dot scatter - top */}
        <div className={styles.artisticDotA1} />
        <div className={styles.artisticDotA2} />
        <div className={styles.artisticDotA3} />
        <div className={styles.artisticDotA4} />

        {/* Dot scatter - bottom */}
        <div className={styles.artisticDotB1} />
        <div className={styles.artisticDotB2} />
        <div className={styles.artisticDotB3} />

        {/* Cross marks */}
        <div className={styles.artisticCross1}>+</div>
        <div className={styles.artisticCross2}>+</div>
        <div className={styles.artisticCross3}>+</div>

        {/* Horizontal accent lines */}
        <div className={styles.artisticLineLeft} />
        <div className={styles.artisticLineRight} />

        {/* Diagonal accent lines */}
        <div className={styles.artisticDiagLeft} />
        <div className={styles.artisticDiagRight} />

        {/* Corner brackets */}
        <div className={styles.artisticCornerTL} />
        <div className={styles.artisticCornerBR} />

        {/* Small floating rings */}
        <div className={styles.artisticRing1} />
        <div className={styles.artisticRing2} />
        <div className={styles.artisticRing3} />

        {/* Main content */}
        <div className={styles.artisticContent}>
          {eyebrow ? (
            <div className={styles.artisticEyebrowRow}>
              <div className={styles.artisticEyebrowDotPurple} />
              <p className={styles.artisticEyebrow}>{eyebrow}</p>
              <div className={styles.artisticEyebrowDotOrange} />
            </div>
          ) : null}
          <p className={styles.artisticTitle}>
            {titleLines.map((line, i) => (
              <span key={i}>
                {i > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </p>
          <div className={styles.artisticDivider} />
          {subtitle ? <p className={styles.artisticSubtitle}>{subtitle}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.breakout}>
      <div className={styles.splitBand}>
        <div className={styles.splitBandPanel}>
          {eyebrow ? (
            <div className={styles.eyebrowRow}>
              <div className={styles.eyebrowLine} />
              <span className={styles.eyebrow}>{eyebrow}</span>
              <div className={styles.eyebrowLine} />
            </div>
          ) : null}
          <p className={styles.splitBandTitle}>{title}</p>
        </div>

        <div className={styles.splitBandContent}>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          {description ? <p className={styles.description}>{description}</p> : null}

          {tags.length ? (
            <div className={styles.tagRow}>
              {tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {hint ? <p className={styles.hint}>{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
