import styles from "./ShowcaseComparisonTable.module.css";

interface ShowcaseComparisonTableProps {
  columns: string[];
  highlightColumn?: number;
  rows: { feature: string; values: string[] }[];
}

export function ShowcaseComparisonTable({
  columns,
  highlightColumn,
  rows,
}: ShowcaseComparisonTableProps) {
  return (
    <div data-growable="" className={styles.root}>
      <div
        className={styles.table}
        style={{ gridTemplateColumns: `2.5fr ${columns.map(() => "1fr").join(" ")}` }}
      >
        {/* Header row */}
        <div className={styles.headerEmpty} />
        {columns.map((col, ci) => (
          <div key={ci} className={styles.headerCell}>
            <p
              className={
                ci === highlightColumn
                  ? styles.headerTextHighlight
                  : styles.headerText
              }
            >
              {col}
            </p>
          </div>
        ))}

        {/* Data rows */}
        {rows.map((row, ri) => {
          const isLast = ri === rows.length - 1;

          return (
            <RowCells
              key={ri}
              feature={row.feature}
              values={row.values}
              isLast={isLast}
            />
          );
        })}
      </div>
    </div>
  );
}

function RowCells({
  feature,
  values,
  isLast,
}: {
  feature: string;
  values: string[];
  isLast: boolean;
}) {
  return (
    <>
      <div className={isLast ? styles.featureCellLast : styles.featureCell}>
        <p className={styles.featureText}>{feature}</p>
      </div>
      {values.map((val, vi) => (
        <div
          key={vi}
          className={isLast ? styles.valueCellLast : styles.valueCell}
        >
          <p className={styles.valueText}>{val}</p>
        </div>
      ))}
    </>
  );
}
