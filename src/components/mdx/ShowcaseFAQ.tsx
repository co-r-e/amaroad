import styles from "./ShowcaseFAQ.module.css";

interface FAQItem {
  question: string;
  answer: string;
}

interface ShowcaseFAQProps {
  items: FAQItem[];
}

export function ShowcaseFAQ({ items }: ShowcaseFAQProps) {
  return (
    <div data-growable="" className={styles.root}>
      {items.map((item, i) => (
        <div key={i} className={styles.item}>
          <p className={styles.question}>{item.question}</p>
          <p className={styles.answer}>{item.answer}</p>
        </div>
      ))}
    </div>
  );
}
