import { Video } from "./Video";
import styles from "./ShowcaseVideo.module.css";

interface ShowcaseVideoProps {
  variant?: "standalone" | "with-description";
  src: string;
  videoTitle?: string;
  title?: string;
  description?: string;
  bullets?: string[];
}

export function ShowcaseVideo({
  variant = "standalone",
  src,
  videoTitle,
  title,
  description,
  bullets = [],
}: ShowcaseVideoProps) {
  if (variant === "with-description") {
    return (
      <div data-growable="" className={styles.withDescRoot}>
        <div className={styles.videoColumn}>
          <Video src={src} title={videoTitle ?? title ?? "Video"} />
        </div>
        <div className={styles.descColumn}>
          {title ? <p className={styles.descTitle}>{title}</p> : null}
          {description ? (
            <p className={styles.descBody}>{description}</p>
          ) : null}
          {bullets.length > 0 ? (
            <p className={styles.descBullets}>
              {bullets.map((bullet, i) => (
                <span key={i}>
                  {"\u30FB"}
                  {bullet}
                  {i < bullets.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div data-growable="" className={styles.standaloneRoot}>
      <Video src={src} title={videoTitle ?? "Video"} />
    </div>
  );
}
