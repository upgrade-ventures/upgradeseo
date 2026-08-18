import { useQuery } from "@tanstack/react-query";
import { InfoNote } from "@/client/components/prominence/Primitives";
import { TimelineEntry } from "@/client/features/dashboard/RecentActivityCard";
import { getDashboardActivity } from "@/serverFunctions/dashboard";
import type { DashboardActivityEntry } from "@/server/features/dashboard/services/DashboardService";

/**
 * The dashboard's Activity tab.
 *
 * Every entry is a real record — an audit run, a rank check, a connection — read
 * back from the rows the app already writes. A project with no history shows an
 * empty state, never a sample timeline.
 */
export function ActivityTimeline({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ["dashboardActivity", projectId],
    queryFn: () => getDashboardActivity({ data: { projectId } }),
  });

  if (query.isPending) {
    return (
      <div style={{ padding: "4px 0" }}>
        {[0, 1, 2].map((row) => (
          <div key={row} style={ROW} aria-hidden="true">
            <span
              style={{
                ...DOT,
                background: "var(--inset)",
                animation: "shimmer 1.4s ease-in-out infinite",
              }}
            />
            <span
              style={{
                height: 12,
                width: 180,
                borderRadius: 4,
                background: "var(--inset)",
                animation: "shimmer 1.4s ease-in-out infinite",
              }}
            />
          </div>
        ))}
        <span className="sr-only">Loading activity</span>
      </div>
    );
  }

  if (query.isError) {
    return (
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>
        Could not load activity. Refresh to try again.
      </p>
    );
  }

  const entries = query.data ?? [];
  if (entries.length === 0) {
    return (
      <div style={{ padding: "6px 0" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
          Nothing has happened yet
        </p>
        <InfoNote>
          Audits, rank checks and new connections show up here as they run.
        </InfoNote>
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry: DashboardActivityEntry, index: number) => (
        <TimelineEntry
          key={entry.id}
          entry={entry}
          last={index === entries.length - 1}
          variant="activity"
        />
      ))}
    </div>
  );
}

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "7px 0",
  borderBottom: "1px solid var(--border-muted)",
};

const DOT: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0,
};
