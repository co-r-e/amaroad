import styles from "./ShowcaseLayerStack.module.css";

interface Layer {
  label: string;
  items?: string[];
  highlighted?: boolean;
}

interface ShowcaseLayerStackProps {
  layers: Layer[];
}

export function ShowcaseLayerStack({ layers }: ShowcaseLayerStackProps) {
  /* Determine layout mode: if any layer has 3+ items, use label+items rows.
     Otherwise use full-width bars (like the 71-layer-stack pattern). */
  const hasItemRows = layers.some((l) => l.items && l.items.length >= 2);

  return (
    <div className={styles.stack} data-growable="">
      {layers.map((layer, i) => {
        if (hasItemRows && layer.items && layer.items.length >= 2) {
          return (
            <div key={i} className={styles.layer}>
              <div className={styles.layerLabel}>
                <p className={styles.layerLabelText}>{layer.label}</p>
              </div>
              <div className={styles.layerItems}>
                {layer.items.map((item, j) => (
                  <div key={j} className={styles.layerItem}>
                    <p className={styles.layerItemText}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        /* Full-width bar mode */
        return (
          <div
            key={i}
            className={
              layer.highlighted
                ? styles.layerBarHighlighted
                : styles.layerBar
            }
          >
            <p
              className={
                layer.highlighted
                  ? styles.layerBarLabelHighlighted
                  : styles.layerBarLabel
              }
            >
              {layer.label}
            </p>
            {layer.items && layer.items.length > 0 ? (
              <p
                className={
                  layer.highlighted
                    ? styles.layerBarItemsHighlighted
                    : styles.layerBarItems
                }
              >
                {layer.items.join(" \u00B7 ")}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
