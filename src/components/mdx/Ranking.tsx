import type { ReactNode } from "react";
import styles from "./Ranking.module.css";

interface RankingProps {
  children: ReactNode;
  style?: React.CSSProperties;
}

export function Ranking({ children, style }: RankingProps) {
  return (
    <div data-growable="" className={styles.ranking} style={style}>
      {children}
    </div>
  );
}

interface RankItemProps {
  rank: number;
  title: string;
  value?: string;
  children?: ReactNode;
  color?: string;
  style?: React.CSSProperties;
}

export function RankItem({
  rank,
  title,
  value,
  children,
  color,
  style,
}: RankItemProps) {
  const accentColor = color ?? "var(--slide-primary)";
  const isTopThree = rank <= 3;

  return (
    <div className={styles.item} style={style}>
      <div
        className={styles.rankCircle}
        style={{
          background: accentColor,
          width: isTopThree ? "3.6rem" : "3rem",
          height: isTopThree ? "3.6rem" : "3rem",
        }}
      >
        <span className={styles.rankNumber}>{rank}</span>
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.description}>{children}</div>}
      </div>
      {value && (
        <span className={styles.value} style={{ color: accentColor }}>
          {value}
        </span>
      )}
    </div>
  );
}
