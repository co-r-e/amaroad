import { Icon } from "./Icon";
import styles from "./ScreenshotCallouts.module.css";

interface ScreenshotCalloutItem {
  label: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

interface ScreenshotCalloutsProps {
  items: ScreenshotCalloutItem[];
  src?: string;
  alt?: string;
}

export function ScreenshotCallouts({
  items,
  src,
  alt,
}: ScreenshotCalloutsProps) {
  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.image} src={src} alt={alt ?? ""} />
        ) : (
          <div className={styles.placeholder}>
            <Icon name="image" size={80} color="currentColor" />
          </div>
        )}
      </div>

      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className={styles.callout}
          style={{
            top: item.top,
            right: item.right,
            bottom: item.bottom,
            left: item.left,
          }}
        >
          <div className={styles.marker}>
            <span className={styles.number}>{index + 1}</span>
          </div>
          <span className={styles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
