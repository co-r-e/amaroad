import type { CSSProperties, ReactNode } from "react";
import { getLayoutSpec, type LayoutDefinition, type LayoutVariant } from "@/lib/layout-spec";
import { getVariant, type StrictCardItem, type StrictSlotContent } from "@/lib/strict-schema";
import type { SlideData } from "@/types/deck";

interface StrictSlideMarkupProps {
  slide: SlideData;
  overflowingSlots?: Set<string>;
  fitStatus?: "measuring" | "fit" | "overflow";
  overflowSlotsAttr?: string;
}

export function StrictSlideMarkup({
  slide,
  overflowingSlots,
  fitStatus,
  overflowSlotsAttr,
}: StrictSlideMarkupProps): React.JSX.Element {
  if (!slide.strictInput) {
    throw new Error("StrictSlideMarkup requires slide.strictInput.");
  }

  const spec = getLayoutSpec(slide.strictInput.layout);
  const variant = getVariant(spec, slide.strictInput.variantId);

  return (
    <div
      data-strict-root=""
      data-fit-status={fitStatus}
      data-overflow-slots={overflowSlotsAttr}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
      }}
    >
      {Object.entries(spec.slots).map(([slotName, slotSpec]) => {
        const content = slide.strictInput?.slots[slotName];
        if (!content) return null;

        return (
          <div
            key={slotName}
            data-strict-slot={slotName}
            style={getSlotContainerStyle(
              slotName,
              slotSpec.frame,
              slotSpec.typography,
              content,
              variant,
              overflowingSlots?.has(slotName) ?? false,
            )}
          >
            <div style={getSlotInnerStyle(content, slotName, slotSpec.frame.w)}>
              {renderSlotContent(slotName, content, variant)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getSlotContainerStyle(
  slotName: string,
  frame: LayoutDefinition["slots"][string]["frame"],
  typography: LayoutDefinition["slots"][string]["typography"],
  content: StrictSlotContent,
  variant: LayoutVariant,
  overflowing: boolean,
): CSSProperties {
  return {
    position: "absolute",
    left: `${frame.x}%`,
    top: `${frame.y}%`,
    width: `${frame.w}%`,
    height: `${frame.h}%`,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    color: getSlotTextColor(slotName, content, variant),
    fontSize: `${typography.fontSize}px`,
    lineHeight: String(typography.lineHeight),
    fontWeight: typography.fontWeight,
    letterSpacing: typography.letterSpacing,
    fontFamily: isHeadingSlot(slotName, content.kind)
      ? "var(--slide-font-heading)"
      : "var(--slide-font-body)",
    outline: overflowing ? "2px dashed rgba(220, 38, 38, 0.55)" : undefined,
    outlineOffset: overflowing ? "-2px" : undefined,
    borderRadius: overflowing ? "1rem" : undefined,
  };
}

function getSlotInnerStyle(
  content: StrictSlotContent,
  slotName: string,
  slotWidth: number,
): CSSProperties {
  if (content.kind === "steps" && shouldUseStepCardGrid(slotName, content.items.length, slotWidth)) {
    return {
      width: "100%",
      height: "100%",
      minWidth: 0,
      minHeight: 0,
      display: "grid",
      gridTemplateColumns: content.items.length === 1 ? "1fr" : "1fr 1fr",
      gridAutoRows: "1fr",
      gap: "0.9rem",
      alignContent: "stretch",
    };
  }

  if (content.kind === "cardList" && shouldUseThreeColumnCards(slotName, content.items.length)) {
    return {
      width: "100%",
      height: "100%",
      minWidth: 0,
      minHeight: 0,
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: "0.9rem",
      alignContent: "stretch",
    };
  }

  if (content.kind === "cardList" && content.items.length === 2 && shouldUseTwoColumnCards(slotName, slotWidth)) {
    return {
      width: "100%",
      height: "100%",
      minWidth: 0,
      minHeight: 0,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridAutoRows: "1fr",
      gap: "0.8rem",
      alignContent: "stretch",
    };
  }

  if (content.kind === "cardList" && shouldStretchCardStack(slotName)) {
    return {
      width: "100%",
      height: "100%",
      minWidth: 0,
      minHeight: 0,
      display: "grid",
      gridAutoRows: "1fr",
      alignContent: "stretch",
      gap: "0.9rem",
    };
  }

  if (
    content.kind === "card"
    || content.kind === "cardList"
    || content.kind === "steps"
    || content.kind === "comparisonItems"
    || content.kind === "timelineItems"
  ) {
    return {
      width: "100%",
      height: "100%",
      minWidth: 0,
      minHeight: 0,
      display: "grid",
      alignContent: "stretch",
      gap: "0.8rem",
    };
  }

  return {
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    display: "grid",
    alignContent: "start",
    gap: "0.75rem",
  };
}

function renderSlotContent(
  slotName: string,
  content: StrictSlotContent,
  variant: LayoutVariant,
): ReactNode {
  switch (content.kind) {
    case "text":
      return <div style={{ whiteSpace: "pre-wrap", textWrap: "pretty" }}>{content.text}</div>;
    case "richText":
      return (
        <div style={{ display: "grid", alignContent: "start", gap: "0.55rem" }}>
          {content.paragraphs.map((paragraph, index) => (
            <p key={index} style={{ margin: 0 }}>
              {paragraph}
            </p>
          ))}
        </div>
      );
    case "quote":
      return (
        <blockquote style={{ margin: 0, display: "grid", gap: "0.75rem" }}>
          <div>{content.text}</div>
          {content.attribution ? (
            <footer
              style={{
                fontSize: "1rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                opacity: 0.68,
              }}
            >
              {content.attribution}
            </footer>
          ) : null}
        </blockquote>
      );
    case "stat":
      return (
        <div style={{ display: "grid", alignContent: "start", gap: "0.4rem" }}>
          {content.label ? (
            <div
              style={{
                fontSize: "1rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                opacity: 0.68,
              }}
            >
              {content.label}
            </div>
          ) : null}
          <div style={{ fontWeight: 700, lineHeight: 1 }}>{content.value}</div>
          {content.detail ? <div style={{ fontSize: "1.2rem", lineHeight: 1.34 }}>{content.detail}</div> : null}
        </div>
      );
    case "card":
      return renderCard(slotName, content.item, variant, 0);
    case "cardList":
      return content.items.map((item, index) => renderCard(slotName, item, variant, index));
    case "steps":
      if (shouldUseStepCardGrid(slotName, content.items.length, 100)) {
        return content.items.map((item, index) =>
          renderStepCard(
            slotName,
            item.number ?? String(index + 1).padStart(2, "0"),
            item.title,
            item.body,
            item.label,
            variant,
            index,
          ),
        );
      }
      return (
        <div style={{ display: "grid", alignContent: "start", gap: "0.7rem", height: "100%" }}>
          {content.items.map((item, index) => (
            <div
              key={`${item.number ?? index}-${item.title}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(2.4rem, auto) 1fr",
                gap: "0.75rem",
                minWidth: 0,
              }}
            >
              <div style={{ fontWeight: 700, lineHeight: 1 }}>
                {item.number ?? String(index + 1).padStart(2, "0")}
              </div>
              <div style={{ minWidth: 0, display: "grid", gap: "0.25rem" }}>
                <div style={{ fontSize: "1.45rem", lineHeight: 1.22, fontWeight: 600 }}>{item.title}</div>
                {item.body.map((paragraph, bodyIndex) => (
                  <div key={bodyIndex} style={{ fontSize: "1.18rem", lineHeight: 1.3 }}>
                    {paragraph}
                  </div>
                ))}
                {item.label ? (
                  <div
                    style={{
                      fontSize: "0.95rem",
                      lineHeight: 1.2,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.label}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      );
    case "comparisonItems":
      return (
        <div style={{ display: "grid", alignContent: "start", gap: "0.7rem", height: "100%" }}>
          {content.items.map((item) => (
            <div key={item.label} style={{ display: "grid", gap: "0.25rem" }}>
              <div style={{ fontSize: "1.45rem", lineHeight: 1.22, fontWeight: 600 }}>{item.label}</div>
              {item.body.map((paragraph, index) => (
                <div key={index} style={{ fontSize: "1.18rem", lineHeight: 1.3 }}>
                  {paragraph}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case "timelineItems":
      return (
        <div style={{ display: "grid", alignContent: "start", gap: "0.7rem", height: "100%" }}>
          {content.items.map((item) => (
            <div
              key={`${item.label}-${item.title}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(2.4rem, auto) 1fr",
                gap: "0.75rem",
                minWidth: 0,
              }}
            >
              <div style={{ fontWeight: 700, lineHeight: 1 }}>{item.label}</div>
              <div style={{ minWidth: 0, display: "grid", gap: "0.25rem" }}>
                <div style={{ fontSize: "1.45rem", lineHeight: 1.22, fontWeight: 600 }}>{item.title}</div>
                {item.body.map((paragraph, index) => (
                  <div key={index} style={{ fontSize: "1.18rem", lineHeight: 1.3 }}>
                    {paragraph}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
  }
}

function renderCard(
  slotName: string,
  item: StrictCardItem,
  variant: LayoutVariant,
  index: number,
): React.JSX.Element {
  const surface = getCardSurface(slotName, variant, item.emphasis ?? false, index);
  const titleSize = slotName === "cards" ? "1em" : "1.08em";
  const bodySize = slotName === "cards" ? "0.76em" : "0.8em";
  const padding = slotName === "cards" ? "0.8rem 0.9rem" : "1.1rem 1.2rem";

  return (
    <div
      key={`${item.label ?? "card"}-${item.title ?? index}`}
      style={{
        ...surface,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        borderRadius: "1.25rem",
        padding,
        display: "grid",
        alignContent: "space-between",
        gap: "0.45rem",
      }}
    >
      {item.label ? (
        <div
          style={{
            fontSize: "0.48em",
            lineHeight: 1.2,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {item.label}
        </div>
      ) : null}
      {item.title ? (
        <div style={{ fontSize: titleSize, lineHeight: 1.22, fontWeight: 600 }}>{item.title}</div>
      ) : null}
      {item.body.map((paragraph, paragraphIndex) => (
        <div key={paragraphIndex} style={{ fontSize: bodySize, lineHeight: 1.32 }}>
          {paragraph}
        </div>
      ))}
    </div>
  );
}

function renderStepCard(
  slotName: string,
  number: string,
  title: string,
  body: string[],
  label: string | undefined,
  variant: LayoutVariant,
  index: number,
): React.JSX.Element {
  const surface = getCardSurface(slotName, variant, index === 0, index);

  return (
    <div
      key={`${number}-${title}`}
      style={{
        ...surface,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        borderRadius: "1.35rem",
        padding: "1.15rem 1.2rem",
        display: "grid",
        alignContent: "space-between",
        gap: "0.55rem",
      }}
    >
      <div style={{ fontSize: "2rem", lineHeight: 1, fontWeight: 700 }}>{number}</div>
      <div style={{ fontSize: "1.08em", lineHeight: 1.2, fontWeight: 700 }}>{title}</div>
      {body.map((paragraph, bodyIndex) => (
        <div key={bodyIndex} style={{ fontSize: "0.8em", lineHeight: 1.32 }}>
          {paragraph}
        </div>
      ))}
      {label ? (
        <div
          style={{
            fontSize: "0.5em",
            lineHeight: 1.2,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.76,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

function getCardSurface(
  slotName: string,
  variant: LayoutVariant,
  emphasis: boolean,
  index: number,
): CSSProperties {
  const accentPreferred = emphasis || /accent|emphasis|workflow|positioning|premise/i.test(slotName);
  if (accentPreferred && (index === 0 || emphasis)) {
    return {
      background: "var(--slide-accent)",
      color: "#171311",
      border: "1px solid color-mix(in srgb, var(--slide-accent) 70%, #171311 10%)",
    };
  }

  if (variant.tone === "dark") {
    return {
      background: "rgba(255,255,255,0.06)",
      color: "#F7EFE8",
      border: "1px solid rgba(255,255,255,0.12)",
    };
  }

  return {
    background: "var(--slide-surface)",
    color: "var(--slide-text)",
    border: "1px solid var(--slide-border)",
  };
}

function getSlotTextColor(
  slotName: string,
  content: StrictSlotContent,
  variant: LayoutVariant,
): string {
  if (content.kind === "card" || content.kind === "cardList" || content.kind === "steps") {
    return "inherit";
  }

  if (variant.tone === "dark") {
    if (/sectionLabel|eyebrow|kicker/.test(slotName)) return "rgba(255,255,255,0.52)";
    return "#F7EFE8";
  }

  if (/sectionLabel|eyebrow|kicker/.test(slotName)) return "var(--slide-text-subtle)";
  return "var(--slide-text)";
}

function isHeadingSlot(slotName: string, kind: StrictSlotContent["kind"]): boolean {
  if (kind === "quote") return true;
  return /title|headline/.test(slotName);
}

function shouldUseTwoColumnCards(slotName: string, slotWidth: number): boolean {
  return /chips|meta/i.test(slotName) || slotWidth >= 36;
}

function shouldStretchCardStack(slotName: string): boolean {
  return /pointList|layers/i.test(slotName);
}

function shouldUseStepCardGrid(
  slotName: string,
  itemCount: number,
  slotWidth: number,
): boolean {
  return slotName === "steps" && slotWidth >= 60 && itemCount <= 4;
}

function shouldUseThreeColumnCards(slotName: string, itemCount: number): boolean {
  return slotName === "cards" && itemCount === 3;
}
