import styles from "./LogoWall.module.css";

interface LogoWallProps {
  logos: string[];
  columns?: number;
}

export function LogoWall({
  logos,
  columns = 4,
}: LogoWallProps) {
  return (
    <div
      data-growable=""
      className={styles.grid}
      style={{ ["--logo-columns" as string]: String(columns) }}
    >
      {logos.map((logo, index) => (
        <div key={`${logo}-${index}`} className={styles.item}>
          <span className={styles.label}>{logo}</span>
        </div>
      ))}
    </div>
  );
}
