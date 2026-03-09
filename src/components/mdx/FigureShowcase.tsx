import { Icon } from "./Icon";
import styles from "./FigureShowcase.module.css";

type FigureShowcaseVariant =
  | "caption-bottom"
  | "caption-top"
  | "left-caption"
  | "right-caption"
  | "comparison"
  | "overlay"
  | "card-list"
  | "three-flow"
  | "heading-image"
  | "three-caption"
  | "image-text"
  | "text-image"
  | "full-dark"
  | "stacked"
  | "column-image-text";

interface FigureShowcaseItem {
  title?: string;
  description?: string;
  src?: string;
  alt?: string;
  label?: string;
}

interface FigureShowcaseProps {
  variant?: FigureShowcaseVariant;
  title?: string;
  subtitle?: string;
  description?: string;
  src?: string;
  alt?: string;
  imageLabel?: string;
  leftTitle?: string;
  leftDescription?: string;
  leftSrc?: string;
  leftAlt?: string;
  rightTitle?: string;
  rightDescription?: string;
  rightSrc?: string;
  rightAlt?: string;
  /** For variants with multiple items (three-flow, three-caption, stacked, column-image-text) */
  items?: FigureShowcaseItem[];
  /** For card-list variant */
  cards?: { title: string; description: string }[];
  /** For image-text variant */
  bullets?: string[];
  /** For image-text variant */
  quote?: string;
  /** For full-dark variant */
  label?: string;
}

function FigureMedia({
  src,
  alt,
  label = "Image",
  grow = false,
}: {
  src?: string;
  alt?: string;
  label?: string;
  grow?: boolean;
}) {
  return (
    <div data-growable={grow ? "" : undefined} className={`${styles.mediaFrame} ${grow ? styles.mediaGrow : ""}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.mediaImage} src={src} alt={alt ?? ""} />
      ) : (
        <div className={styles.placeholder}>
          <Icon name="image" size={80} color="currentColor" />
          <span className={styles.placeholderLabel}>{label}</span>
        </div>
      )}
    </div>
  );
}

function CaptionCopy({
  title,
  description,
  showLine = false,
}: {
  title?: string;
  description?: string;
  showLine?: boolean;
}) {
  if (!title && !description) return null;

  return (
    <div className={styles.copyBlock}>
      {title ? <p className={styles.title}>{title}</p> : null}
      {showLine ? <div className={styles.accentLine} /> : null}
      {description ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
}

function FlowArrow() {
  return (
    <svg className={styles.threeFlowArrow} width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
      <line x1="4" y1="24" x2="38" y2="24" stroke="var(--slide-primary)" strokeWidth="3" />
      <polyline
        points="30,16 38,24 30,32"
        fill="none"
        stroke="var(--slide-primary)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FigureShowcase({
  variant = "caption-bottom",
  title,
  subtitle,
  description,
  src,
  alt,
  imageLabel,
  leftTitle,
  leftDescription,
  leftSrc,
  leftAlt,
  rightTitle,
  rightDescription,
  rightSrc,
  rightAlt,
  items,
  cards,
  bullets,
  quote,
  label,
}: FigureShowcaseProps) {
  /* ── comparison ── */
  if (variant === "comparison") {
    return (
      <div className={styles.root}>
        <div data-growable="" className={styles.comparisonRow}>
          <FigureMedia src={leftSrc} alt={leftAlt} label={imageLabel} grow />
          <svg className={styles.comparisonArrow} width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
            <line x1="4" y1="24" x2="38" y2="24" stroke="var(--slide-primary)" strokeWidth="3" />
            <polyline
              points="30,16 38,24 30,32"
              fill="none"
              stroke="var(--slide-primary)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
          <FigureMedia src={rightSrc} alt={rightAlt} label={imageLabel} grow />
        </div>
        <div className={styles.comparisonCopy}>
          <div className={styles.comparisonColumn}>
            {leftTitle ? <p className={styles.comparisonTitle}>{leftTitle}</p> : null}
            {leftDescription ? <p className={styles.comparisonDescription}>{leftDescription}</p> : null}
          </div>
          <div className={styles.comparisonColumn}>
            {rightTitle ? <p className={styles.comparisonTitle}>{rightTitle}</p> : null}
            {rightDescription ? <p className={styles.comparisonDescription}>{rightDescription}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  /* ── overlay ── */
  if (variant === "overlay") {
    return (
      <div className={styles.root}>
        <div data-growable="" className={`${styles.mediaFrame} ${styles.mediaGrow} ${styles.overlay}`}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.mediaImage} src={src} alt={alt ?? ""} />
          ) : (
            <div className={styles.placeholder}>
              <Icon name="image" size={120} color="#333333" />
            </div>
          )}
          <div className={styles.overlayContent}>
            {title ? <p className={styles.titleLg}>{title}</p> : null}
            {description ? <p className={styles.descriptionLight}>{description}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  /* ── left-caption / right-caption ── */
  if (variant === "left-caption" || variant === "right-caption") {
    const reverse = variant === "right-caption";
    return (
      <div className={`${styles.sideLayout} ${reverse ? styles.sideLayoutReverse : ""}`}>
        {reverse ? (
          <>
            <div className={styles.sideCopy}>
              <CaptionCopy title={title} description={description} showLine />
            </div>
            <FigureMedia src={src} alt={alt} label={imageLabel} grow />
          </>
        ) : (
          <>
            <FigureMedia src={src} alt={alt} label={imageLabel} grow />
            <div className={styles.sideCopy}>
              <CaptionCopy title={title} description={description} showLine />
            </div>
          </>
        )}
      </div>
    );
  }

  /* ── card-list ── */
  if (variant === "card-list") {
    return (
      <div className={styles.cardListLayout}>
        <FigureMedia src={src} alt={alt} label={imageLabel} grow />
        <div className={styles.cardListStack}>
          {(cards ?? []).map((card, i) => (
            <div key={i} className={styles.cardListItem}>
              <p className={styles.cardListItemTitle}>{card.title}</p>
              <p className={styles.cardListItemDesc}>{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── three-flow ── */
  if (variant === "three-flow") {
    const safeItems = items ?? [{}, {}, {}];
    const elements: React.ReactNode[] = [];
    safeItems.forEach((item, i) => {
      if (i > 0) {
        elements.push(<FlowArrow key={`arrow-${i}`} />);
      }
      elements.push(
        <FigureMedia key={`media-${i}`} src={item.src} alt={item.alt} label={item.label ?? "Image"} grow />
      );
    });
    return <div className={styles.threeFlowRow}>{elements}</div>;
  }

  /* ── heading-image ── */
  if (variant === "heading-image") {
    return (
      <div className={styles.root}>
        {title ? <p className={styles.headingImageTitle}>{title}</p> : null}
        <FigureMedia src={src} alt={alt} label={imageLabel} grow />
        {subtitle ? <p className={styles.headingImageSubtitle}>{subtitle}</p> : null}
      </div>
    );
  }

  /* ── three-caption ── */
  if (variant === "three-caption") {
    const safeItems = items ?? [{}, {}, {}];
    return (
      <div className={styles.root}>
        <div data-growable="" className={styles.threeCaptionRow}>
          {safeItems.map((item, i) => (
            <div key={i} className={styles.threeCaptionItem}>
              <FigureMedia src={item.src} alt={item.alt} label={item.label ?? "Image"} grow />
            </div>
          ))}
        </div>
        {title ? <p className={styles.threeCaptionTitle}>{title}</p> : null}
      </div>
    );
  }

  /* ── image-text / text-image ── */
  if (variant === "image-text" || variant === "text-image") {
    const reverse = variant === "text-image";
    const copyBlock = (
      <div className={styles.imageTextCopy}>
        {title ? <p className={styles.imageTextTitle}>{title}</p> : null}
        {description ? <p className={styles.imageTextDesc}>{description}</p> : null}
        {bullets && bullets.length > 0 ? (
          <p className={styles.imageTextBullets}>
            {bullets.map((b, i) => (
              <span key={i}>
                {"\u30FB"}{b}
                {i < bullets.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        ) : null}
        {quote ? (
          <div className={styles.imageTextQuote}>
            <p className={styles.imageTextQuoteText}>{"\u201C"}{quote}{"\u201D"}</p>
          </div>
        ) : null}
      </div>
    );

    return (
      <div className={`${styles.imageTextLayout} ${reverse ? styles.imageTextLayoutReverse : ""}`}>
        {reverse ? (
          <>
            {copyBlock}
            <FigureMedia src={src} alt={alt} label={imageLabel} grow />
          </>
        ) : (
          <>
            <FigureMedia src={src} alt={alt} label={imageLabel} grow />
            {copyBlock}
          </>
        )}
      </div>
    );
  }

  /* ── full-dark ── */
  if (variant === "full-dark") {
    return (
      <div className={styles.fullDarkRoot}>
        <div className={styles.fullDarkImage}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div className={styles.placeholder}>
              <Icon name="image" size={120} color="var(--slide-text-subtle)" />
            </div>
          )}
        </div>
        <div className={styles.fullDarkOverlay}>
          {label ? <p className={styles.fullDarkLabel}>{label}</p> : null}
          {title ? <p className={styles.fullDarkTitle}>{title}</p> : null}
          {description ? <p className={styles.fullDarkDesc}>{description}</p> : null}
        </div>
      </div>
    );
  }

  /* ── stacked ── */
  if (variant === "stacked") {
    const safeItems = items ?? [{}, {}];
    return (
      <div className={styles.stackedColumn}>
        {safeItems.map((item, i) => (
          <div key={i} className={styles.stackedItem}>
            <FigureMedia src={item.src} alt={item.alt} label={item.label ?? "Image"} grow />
          </div>
        ))}
      </div>
    );
  }

  /* ── column-image-text ── */
  if (variant === "column-image-text") {
    const safeItems = items ?? [];
    const isThree = safeItems.length >= 3;
    return (
      <div
        className={`${styles.columnImageTextRow} ${isThree ? styles.columnImageTextRow3 : styles.columnImageTextRow2}`}
      >
        {safeItems.map((item, i) => (
          <div key={i} className={styles.columnImageTextItem}>
            <div className={`${styles.columnImageTextMedia} ${isThree ? styles.columnImageTextMedia3 : ""}`}>
              {item.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.src} alt={item.alt ?? ""} />
              ) : (
                <Icon name="image" size={isThree ? 36 : 40} color="var(--slide-text-subtle)" />
              )}
            </div>
            {item.label ? <p className={styles.columnImageTextLabel}>{item.label}</p> : null}
            {item.title ? (
              <p className={`${styles.columnImageTextTitle} ${item.label ? styles.columnImageTextTitle600 : ""}`}>
                {item.title}
              </p>
            ) : null}
            {item.description ? <p className={styles.columnImageTextDesc}>{item.description}</p> : null}
          </div>
        ))}
      </div>
    );
  }

  /* ── caption-top / caption-bottom (default) ── */
  return (
    <div className={styles.root}>
      {variant === "caption-top" ? <CaptionCopy title={title} description={description} /> : null}
      <FigureMedia src={src} alt={alt} label={imageLabel} grow />
      {variant === "caption-bottom" ? <CaptionCopy title={title} description={description} /> : null}
    </div>
  );
}
