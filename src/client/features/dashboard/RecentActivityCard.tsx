import { useQuery } from "@tanstack/react-query";
import { Card, InfoNote } from "@/client/components/prominence/Primitives";
import { getDashboardActivity } from "@/serverFunctions/dashboard";
import type { DashboardActivityEntry } from "@/server/features/dashboard/services/DashboardService";

/** The design shows four entries on the Overview tab. */
const OVERVIEW_ENTRIES = 4;

/**
 * "Recent activity" on the Overview tab.
 *
 * Same real records as the Activity tab, trimmed to four. The rail is drawn with
 * a left border on every entry except the last, so the line stops at the final
 * dot instead of trailing into the card's padding.
 */
export function RecentActivityCard({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ["dashboardActivity", projectId],
    queryFn: () => getDashboardActivity({ data: { projectId } }),
  });

  return (
    <Card title="Recent activity">
      <div style={{ padding: 12 }}>
        {query.isPending ? (
          <div aria-hidden="true">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                style={{ ...entryStyle(false), paddingBottom: 12 }}
              >
                <span
                  style={{
                    height: 12,
                    width: 200,
                    borderRadius: 4,
                    background: "var(--inset)",
                    animation: "shimmer 1.4s ease-in-out infinite",
                  }}
                />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>
            Could not load activity.
          </p>
        ) : (query.data ?? []).length === 0 ? (
          <>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>
              Nothing yet
            </p>
            <InfoNote>
              Audits, rank checks and new connections appear here as they run.
            </InfoNote>
          </>
        ) : (
          (query.data ?? [])
            .slice(0, OVERVIEW_ENTRIES)
            .map((entry, index, list) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                last={index === list.length - 1}
              />
            ))
        )}
      </div>
    </Card>
  );
}

export function TimelineEntry({
  entry,
  last,
  variant = "overview",
}: {
  entry: DashboardActivityEntry;
  last: boolean;
  /** The Activity tab uses slightly tighter rail metrics than Overview. */
  variant?: "overview" | "activity";
}) {
  return (
    <div style={entryStyle(last, variant)}>
      <span
        style={{
          position: "absolute",
          left: -4,
          top: 4,
          width: 7,
          height: 7,
          borderRadius: 999,
          background: TONE[entry.tone],
          // Ring in the card's own colour so the dot punches through the rail.
          border: "2px solid var(--surface)",
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5 }}>
          <strong style={{ fontWeight: 600 }}>{entry.title}</strong>
          {entry.detail ? ` · ${entry.detail}` : null}
        </div>
        <time
          dateTime={entry.at}
          style={{
            display: "block",
            fontSize: 11.5,
            color: "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
            // The Overview variant carries letter-spacing here; the Activity
            // variant deliberately does not.
            letterSpacing: variant === "overview" ? "0.01em" : undefined,
          }}
        >
          {formatStamp(entry.at)}
        </time>
      </div>
    </div>
  );
}

function entryStyle(
  last: boolean,
  variant: "overview" | "activity" = "overview",
): React.CSSProperties {
  const overview = variant === "overview";
  return {
    position: "relative",
    display: overview ? "flex" : undefined,
    gap: overview ? 10 : undefined,
    marginLeft: overview ? 5 : 4,
    paddingLeft: overview ? 14 : 15,
    paddingBottom: last ? 0 : overview ? 12 : 13,
    // Transparent rather than removed so the last entry keeps its indent.
    borderLeft: `1px solid ${last ? "transparent" : "var(--line)"}`,
  };
}

const TONE: Record<DashboardActivityEntry["tone"], string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
};

/** The design's stamp format: "14 Aug · 11:42". */
function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}
