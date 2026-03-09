import styles from "./ShowcaseQuote.module.css";

interface QuoteItem {
  text: string;
  name: string;
  role?: string;
}

interface ShowcaseQuoteProps {
  items: QuoteItem[];
  columns?: number;
}

export function ShowcaseQuote({
  items,
  columns = 2,
}: ShowcaseQuoteProps) {
  return (
    <div
      data-growable=""
      className={styles.root}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {items.map((item, i) => (
        <div key={i} className={styles.card}>
          <p className={styles.quoteMark}>{"\u201C"}</p>
          <p className={styles.quoteText}>{item.text}</p>
          <div className={styles.attribution}>
            <p className={styles.authorName}>{item.name}</p>
            {item.role ? (
              <p className={styles.authorRole}>{item.role}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
