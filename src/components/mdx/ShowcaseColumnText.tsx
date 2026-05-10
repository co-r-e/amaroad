import styles from "./ShowcaseColumnText.module.css";

interface TextColumn {
  title: string;
  body: string;
}

interface ShowcaseColumnTextProps {
  columns: TextColumn[];
}

export function ShowcaseColumnText({ columns }: ShowcaseColumnTextProps) {
  return (
    <div className={styles.grid}>
      {columns.map((col, i) => (
        <div key={i} className={styles.column}>
          <p className={styles.colTitle}>{col.title}</p>
          <p className={styles.colBody}>{col.body}</p>
        </div>
      ))}
    </div>
  );
}
