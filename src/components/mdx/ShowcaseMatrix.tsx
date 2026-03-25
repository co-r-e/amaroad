import styles from "./ShowcaseMatrix.module.css";

interface MatrixCell {
  label: string;
  highlight?: boolean;
  color?: string;
}

interface ShowcaseMatrixProps {
  xLabel?: string;
  yLabel?: string;
  xHeaders?: string[];
  yHeaders?: string[];
  cells: MatrixCell[][];
  legend?: { label: string; color: string }[];
}

export function ShowcaseMatrix({
  xLabel,
  yLabel,
  xHeaders = [],
  yHeaders = [],
  cells,
  legend,
}: ShowcaseMatrixProps) {
  const colCount = xHeaders.length || (cells[0]?.length ?? 3);
  const hasHeaders = xHeaders.length > 0;
  const hasRowHeaders = yHeaders.length > 0;

  return (
    <div className={styles.root} data-growable="">
      {xLabel ? (
        <div className={styles.xLabelRow}>
          <p className={styles.axisLabel}>{xLabel}</p>
        </div>
      ) : null}

      <div className={styles.body}>
        {yLabel ? (
          <div className={styles.yAxis}>
            <p className={styles.axisLabel}>{yLabel}</p>
          </div>
        ) : null}

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            minHeight: 0,
          }}
        >
          {/* Column headers */}
          {hasHeaders ? (
            <div
              className={styles.headerRow}
              style={{
                gridTemplateColumns: hasRowHeaders
                  ? `120px repeat(${colCount}, 1fr)`
                  : `repeat(${colCount}, 1fr)`,
              }}
            >
              {hasRowHeaders ? <div className={styles.headerSpacer} /> : null}
              {xHeaders.map((h, i) => (
                <p key={i} className={styles.headerCell}>
                  {h}
                </p>
              ))}
            </div>
          ) : null}

          {/* Data rows */}
          <div
            className={styles.dataGrid}
            style={{
              gridTemplateColumns: hasRowHeaders
                ? `120px repeat(${colCount}, 1fr)`
                : `repeat(${colCount}, 1fr)`,
              gridTemplateRows: `repeat(${cells.length}, 1fr)`,
            }}
          >
            {cells.map((row, ri) => (
              <>
                {hasRowHeaders && yHeaders[ri] ? (
                  <div key={`rh-${ri}`} className={styles.rowHeader}>
                    <p className={styles.rowHeaderText}>{yHeaders[ri]}</p>
                  </div>
                ) : null}
                {row.map((cell, ci) => {
                  const bg = cell.color ?? undefined;
                  const isHighlight = cell.highlight;
                  const isPrimaryBg =
                    !cell.color && isHighlight;

                  return (
                    <div
                      key={`${ri}-${ci}`}
                      className={styles.cell}
                      style={{
                        background: isPrimaryBg
                          ? "var(--slide-primary)"
                          : bg ?? undefined,
                        border:
                          isHighlight && !isPrimaryBg
                            ? "1px solid var(--slide-primary)"
                            : undefined,
                      }}
                    >
                      <p
                        className={
                          isPrimaryBg
                            ? styles.cellTextBold
                            : isHighlight
                              ? styles.cellTextHighlight
                              : styles.cellText
                        }
                        style={
                          isPrimaryBg
                            ? {
                                color: "#FFF",
                                fontSize: "calc(2rem * var(--slide-font-scale))",
                              }
                            : cell.color && cell.highlight
                              ? { fontWeight: 700 }
                              : undefined
                        }
                      >
                        {cell.label}
                      </p>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </div>

      {legend && legend.length > 0 ? (
        <div className={styles.legend}>
          {legend.map((item, i) => (
            <div key={i} className={styles.legendItem}>
              <div
                className={styles.legendSwatch}
                style={{ background: item.color }}
              />
              <p className={styles.legendLabel}>{item.label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
