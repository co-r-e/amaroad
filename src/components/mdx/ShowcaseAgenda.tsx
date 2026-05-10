import styles from "./ShowcaseAgenda.module.css";

interface AgendaItem {
  number?: string;
  time?: string;
  title: string;
  description?: string;
}

interface ShowcaseAgendaProps {
  variant?: "list" | "grid" | "highlight" | "grid-3day";
  items?: AgendaItem[];
  activeIndex?: number;
  days?: { label: string; items: AgendaItem[] }[];
}

function ListVariant({ items }: { items: AgendaItem[] }) {
  return (
    <div data-growable="" className={styles.root}>
      {items.map((item, i) => (
        <div key={i} className={styles.listItem}>
          {item.number ? (
            <span className={styles.listNumber}>{item.number}</span>
          ) : null}
          <div>
            <p className={styles.listTitle}>{item.title}</p>
            {item.description ? (
              <p className={styles.listDescription}>{item.description}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function HighlightVariant({
  items,
  activeIndex,
}: {
  items: AgendaItem[];
  activeIndex: number;
}) {
  return (
    <div data-growable="" className={styles.highlightRoot}>
      {items.map((item, i) => {
        const isActive = i === activeIndex;

        if (isActive) {
          return (
            <div key={i} className={styles.highlightItemActive}>
              {item.number ? (
                <span className={styles.highlightNumberActive}>
                  {item.number}
                </span>
              ) : null}
              <div>
                <p className={styles.highlightTitleActive}>{item.title}</p>
                {item.description ? (
                  <p className={styles.highlightDescriptionActive}>
                    {item.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        }

        return (
          <div key={i} className={styles.highlightItemInactive}>
            {item.number ? (
              <span className={styles.highlightNumberInactive}>
                {item.number}
              </span>
            ) : null}
            <p className={styles.highlightTitleInactive}>{item.title}</p>
          </div>
        );
      })}
    </div>
  );
}

function GridVariant({ days }: { days: { label: string; items: AgendaItem[] }[] }) {
  return (
    <div data-growable="" className={styles.gridRoot}>
      {days.map((day, di) => (
        <div key={di} className={styles.dayColumn}>
          <p className={styles.dayLabel}>{day.label}</p>
          {day.items.map((item, ii) => (
            <div key={ii} className={styles.gridItem}>
              {item.time ? (
                <p className={styles.gridTime}>{item.time}</p>
              ) : null}
              <p className={styles.gridTitle}>{item.title}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Grid3DayVariant({
  days,
}: {
  days: { label: string; items: AgendaItem[] }[];
}) {
  return (
    <div data-growable="" className={styles.grid3Root}>
      {days.map((day, di) => (
        <div key={di} className={styles.day3Column}>
          <p className={styles.day3Label}>{day.label}</p>
          {day.items.map((item, ii) => (
            <div key={ii} className={styles.grid3Item}>
              {item.time ? (
                <p className={styles.grid3Time}>{item.time}</p>
              ) : null}
              <p className={styles.grid3Title}>{item.title}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ShowcaseAgenda({
  variant = "list",
  items = [],
  activeIndex = 0,
  days = [],
}: ShowcaseAgendaProps) {
  if (variant === "highlight") {
    return <HighlightVariant items={items} activeIndex={activeIndex} />;
  }

  if (variant === "grid") {
    return <GridVariant days={days} />;
  }

  if (variant === "grid-3day") {
    return <Grid3DayVariant days={days} />;
  }

  return <ListVariant items={items} />;
}
