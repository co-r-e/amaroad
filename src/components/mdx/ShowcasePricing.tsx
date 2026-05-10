import styles from "./ShowcasePricing.module.css";

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  features: string[];
  highlighted?: boolean;
  highlightLabel?: string;
}

interface ShowcasePricingProps {
  tiers: PricingTier[];
}

export function ShowcasePricing({ tiers }: ShowcasePricingProps) {
  return (
    <div
      data-growable=""
      className={styles.root}
      style={{ gridTemplateColumns: `repeat(${tiers.length}, 1fr)` }}
    >
      {tiers.map((tier, i) => (
        <div
          key={i}
          className={`${styles.tier} ${tier.highlighted ? styles.tierHighlighted : ""}`}
        >
          {tier.highlighted && tier.highlightLabel ? (
            <div className={styles.highlightBadge}>
              {tier.highlightLabel}
            </div>
          ) : null}
          <p
            className={`${styles.tierName} ${tier.highlighted ? styles.tierNameHighlighted : ""}`}
          >
            {tier.name}
          </p>
          <p className={styles.priceRow}>
            {tier.price}
            {tier.period ? (
              <span className={styles.pricePeriod}>{tier.period}</span>
            ) : null}
          </p>
          <div className={styles.divider} />
          <p className={styles.features}>
            {tier.features.map((f, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {"\u30FB"}
                {f}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}
