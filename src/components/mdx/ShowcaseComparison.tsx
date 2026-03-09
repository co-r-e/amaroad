import { Icon } from "./Icon";
import styles from "./ShowcaseComparison.module.css";

interface ComparisonItem {
  text: string;
  status?: "done" | "in-progress" | "pending";
}

interface ShowcaseComparisonProps {
  variant?: "checklist" | "before-after" | "do-dont" | "pros-cons";
  items?: ComparisonItem[];
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: string[];
  rightItems?: string[];
}

function ChecklistVariant({ items = [] }: { items: ComparisonItem[] }) {
  return (
    <div className={styles.checklist}>
      {items.map((item, i) => {
        const iconName =
          item.status === "done"
            ? "circle-check"
            : item.status === "in-progress"
              ? "circle-dot"
              : "circle";
        const iconColor =
          item.status === "done"
            ? "var(--slide-primary)"
            : item.status === "in-progress"
              ? "var(--slide-text-muted)"
              : "var(--slide-text-subtle)";
        return (
          <div key={i} className={styles.checklistItem}>
            <Icon name={iconName} size={48} color={iconColor} />
            <p
              className={
                item.status === "pending"
                  ? styles.checklistTextPending
                  : styles.checklistText
              }
            >
              {item.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function BeforeAfterVariant({
  leftTitle = "Before",
  rightTitle = "After",
  leftItems = [],
  rightItems = [],
}: {
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: string[];
  rightItems?: string[];
}) {
  return (
    <div className={styles.twoCol}>
      <div className={styles.baBoxLeft}>
        <div className={styles.baHeader}>
          <Icon name="x-circle" size={40} color="rgb(220,53,69)" />
          <p className={styles.baTitleLeft}>{leftTitle}</p>
        </div>
        <div className={styles.baItemList}>
          {leftItems.map((item, i) => (
            <p key={i} className={styles.baItem}>
              {item}
            </p>
          ))}
        </div>
      </div>
      <div className={styles.baBoxRight}>
        <div className={styles.baHeader}>
          <Icon name="check-circle" size={40} color="var(--slide-primary)" />
          <p className={styles.baTitleRight}>{rightTitle}</p>
        </div>
        <div className={styles.baItemList}>
          {rightItems.map((item, i) => (
            <p key={i} className={styles.baItem}>
              {item}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function DoDontVariant({
  leftTitle = "Do",
  rightTitle = "Don't",
  leftItems = [],
  rightItems = [],
}: {
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: string[];
  rightItems?: string[];
}) {
  return (
    <div className={styles.twoCol}>
      <div className={styles.colPanel}>
        <div className={styles.ddHeader}>
          <Icon name="circle-check" size={28} color="var(--slide-primary)" />
          <p className={styles.ddHeaderLabelDo}>{leftTitle}</p>
        </div>
        {leftItems.map((item, i) => (
          <div key={i} className={styles.ddCard}>
            <p className={styles.ddCardText}>{item}</p>
          </div>
        ))}
      </div>
      <div className={styles.colPanel}>
        <div className={styles.ddHeader}>
          <Icon name="circle-x" size={28} color="var(--slide-text-muted)" />
          <p className={styles.ddHeaderLabelDont}>{rightTitle}</p>
        </div>
        {rightItems.map((item, i) => (
          <div key={i} className={styles.ddCard}>
            <p className={styles.ddCardTextMuted}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProsConsVariant({
  leftTitle = "Option A",
  rightTitle = "Option B",
  leftItems = [],
  rightItems = [],
}: {
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: string[];
  rightItems?: string[];
}) {
  return (
    <div className={styles.twoCol}>
      <div className={styles.colPanel}>
        <p className={styles.pcTitle}>{leftTitle}</p>
        {leftItems.map((item, i) => {
          const isPro = !item.startsWith("[con]");
          const text = item.replace(/^\[(pro|con)\]\s*/, "");
          return (
            <div
              key={i}
              className={isPro ? styles.pcCardPro : styles.pcCardCon}
            >
              <p className={styles.pcItemText}>
                <Icon
                  name={isPro ? "circle-check" : "circle-x"}
                  size={20}
                  color={
                    isPro ? "rgb(34,197,94)" : "rgb(239,68,68)"
                  }
                />
                {text}
              </p>
            </div>
          );
        })}
      </div>
      <div className={styles.colPanel}>
        <p className={styles.pcTitle}>{rightTitle}</p>
        {rightItems.map((item, i) => {
          const isPro = !item.startsWith("[con]");
          const text = item.replace(/^\[(pro|con)\]\s*/, "");
          return (
            <div
              key={i}
              className={isPro ? styles.pcCardPro : styles.pcCardCon}
            >
              <p className={styles.pcItemText}>
                <Icon
                  name={isPro ? "circle-check" : "circle-x"}
                  size={20}
                  color={
                    isPro ? "rgb(34,197,94)" : "rgb(239,68,68)"
                  }
                />
                {text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ShowcaseComparison({
  variant = "checklist",
  items = [],
  leftTitle,
  rightTitle,
  leftItems = [],
  rightItems = [],
}: ShowcaseComparisonProps) {
  if (variant === "checklist") {
    return <ChecklistVariant items={items} />;
  }

  if (variant === "before-after") {
    return (
      <BeforeAfterVariant
        leftTitle={leftTitle}
        rightTitle={rightTitle}
        leftItems={leftItems}
        rightItems={rightItems}
      />
    );
  }

  if (variant === "do-dont") {
    return (
      <DoDontVariant
        leftTitle={leftTitle}
        rightTitle={rightTitle}
        leftItems={leftItems}
        rightItems={rightItems}
      />
    );
  }

  return (
    <ProsConsVariant
      leftTitle={leftTitle}
      rightTitle={rightTitle}
      leftItems={leftItems}
      rightItems={rightItems}
    />
  );
}
