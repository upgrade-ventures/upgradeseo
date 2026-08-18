/**
 * Table skeleton.
 *
 * Built on the same row rule and gutters as the real table so the switch from
 * loading to loaded does not move a single line.
 */
export function TableLoadingRows({ columns = 7 }: { columns?: number }) {
  return (
    <div aria-busy>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: "grid",
            gridTemplateColumns: `minmax(0, 2fr) repeat(${columns - 1}, minmax(0, 1fr))`,
            gap: 12,
            alignItems: "center",
            padding: "9px var(--pad, 24px)",
            borderBottom: "1px solid var(--border-muted)",
          }}
        >
          {Array.from({ length: columns }).map((__, cellIndex) => (
            <div
              key={cellIndex}
              className="skeleton"
              style={{ height: 10, width: cellIndex === 0 ? "70%" : "55%" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
