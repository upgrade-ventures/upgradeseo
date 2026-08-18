import { DomainMetricStripSkeleton } from "@/client/features/domain/components/DomainMetricStrip";
import { TableLoadingRows } from "@/client/features/domain/components/TableLoadingRows";

/**
 * The screen while a lookup is in flight.
 *
 * The design defines no loading state. This one occupies the same bands the
 * loaded screen does, so nothing below the header moves once the answer lands.
 */
export function DomainOverviewLoadingState({
  showMetrics,
  columns,
}: {
  showMetrics: boolean;
  columns: number;
}) {
  return (
    <div aria-busy>
      {showMetrics ? <DomainMetricStripSkeleton /> : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px var(--pad, 24px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="skeleton" style={{ height: 26, width: 86 }} />
        <div className="skeleton" style={{ height: 12, width: 110 }} />
      </div>
      <TableLoadingRows columns={columns} />
    </div>
  );
}
