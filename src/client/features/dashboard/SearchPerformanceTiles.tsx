import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  NoValue,
  SectionHeader,
  StatTile,
} from "@/client/components/prominence/Primitives";
import { getDashboardActivation } from "@/serverFunctions/dashboard";

type SearchSummary = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  previous: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  } | null;
};

/**
 * The design's four Search Console tiles: clicks, impressions, CTR and average
 * position over the last 28 complete days.
 *
 * Every figure is Google's own. A `summary` of null covers two different
 * situations that the design draws differently, so this component has to tell
 * them apart:
 *
 *  - Search Console is not connected at all. Nothing is measurable, so the four
 *    tiles are replaced by one bordered empty-state block (the foundations
 *    page's EmptyStateCard) carrying the consequence and the connect action.
 *  - Search Console is connected but Google returned nothing for the window.
 *    The four tiles stay and each renders an em-dash with its reason inline,
 *    never a zero, which would read as a measured "no clicks" rather than
 *    "not measured".
 */
export function SearchPerformanceTiles({
  projectId,
  summary,
  loading,
}: {
  projectId: string;
  summary: SearchSummary | null;
  loading: boolean;
}) {
  // Read from the same query the dashboard already has in flight, rather than
  // taking a prop: the overview feed collapses "not connected" and "connected,
  // no rows" into the same null, and only the activation feed can separate
  // them. Identical key, so this is a cache read and not a second request.
  const activationQuery = useQuery({
    queryKey: ["dashboardActivation", projectId],
    queryFn: () => getDashboardActivation({ data: { projectId } }),
  });
  // Tri-state on purpose. Until activation has actually resolved we assert
  // neither "not connected" nor "no data": both are claims about the user's
  // account that we cannot yet make.
  const gscConnected = activationQuery.data?.gsc.connected;
  const missing = !loading && summary === null;

  const header = (
    <SectionHeader
      title="Search performance"
      action={
        <Link
          to="/p/$projectId/search-performance"
          params={{ projectId }}
          search={{}}
          style={{ fontSize: 12.5 }}
        >
          Open Search Console report →
        </Link>
      }
    />
  );

  if (missing && gscConnected === false) {
    return (
      <section style={{ marginTop: 16 }}>
        {header}
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            Search Console is not connected
          </div>
          <p
            style={{
              margin: "5px 0 10px",
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            Clicks, impressions, CTR and average position are Google&rsquo;s own
            figures, so none of them can be measured until you connect Search
            Console, which is free.
          </p>
          {/* The landed .prominence-button-primary already carries the design's
              exact primary-button metrics plus the accent focus ring; an anchor
              only needs the box and underline reset a <button> gets by default. */}
          <Link
            to="/p/$projectId/search-performance"
            params={{ projectId }}
            search={{}}
            className="prominence-button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            Connect Search Console
          </Link>
        </div>
      </section>
    );
  }

  // Connected but empty: the reason rides on each card, so the section does not
  // repeat one explanation four times over.
  const reason =
    missing && gscConnected === true ? "no data for this window" : null;

  return (
    <section style={{ marginTop: 16 }}>
      {header}
      <div
        style={{
          display: "grid",
          // Four across when there is room, folding to two then one. The design
          // shows four tiles; this keeps them readable rather than crushed.
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
        }}
      >
        <StatTile
          caption={caption("Clicks · last 28 days", reason)}
          value={loading ? <Skeleton /> : formatCount(summary?.clicks)}
          {...delta(summary, "clicks")}
        />
        <StatTile
          caption={caption("Impressions", reason)}
          value={loading ? <Skeleton /> : formatCount(summary?.impressions)}
          {...delta(summary, "impressions")}
        />
        <StatTile
          caption={caption("CTR", reason)}
          value={loading ? <Skeleton /> : formatCtr(summary?.ctr)}
          {...ctrDelta(summary)}
        />
        <StatTile
          caption={caption("Avg position", reason)}
          value={loading ? <Skeleton /> : formatPosition(summary?.position)}
          {...positionDelta(summary)}
        />
      </div>
    </section>
  );
}

/** Tile caption with the unavailability reason trailing it, design-style. */
function caption(label: string, reason: string | null) {
  if (reason === null) return label;
  return (
    <>
      {label}
      <span style={{ color: "var(--text-3)" }}> · {reason}</span>
    </>
  );
}

function Skeleton() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 64,
        height: 22,
        borderRadius: 4,
        background: "var(--inset)",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

function formatCount(value: number | undefined) {
  if (value == null) return <NoValue />;
  return value.toLocaleString();
}

function formatCtr(value: number | undefined) {
  if (value == null) return <NoValue />;
  return `${(value * 100).toFixed(1)}%`;
}

function formatPosition(value: number | undefined) {
  if (value == null) return <NoValue />;
  return value.toFixed(1);
}

/** Percentage change for a count metric. Absent when there is no prior window. */
type TileDelta = { delta?: string; deltaTone?: "success" | "danger" };

function delta(
  summary: SearchSummary | null,
  key: "clicks" | "impressions",
): TileDelta {
  if (!summary?.previous) return {};
  const before = summary.previous[key];
  // No baseline means no percentage: dividing by zero would print Infinity.
  if (before === 0) return {};
  const change = ((summary[key] - before) / before) * 100;
  return {
    delta: `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`,
    deltaTone: change >= 0 ? "success" : "danger",
  };
}

/** CTR moves in percentage POINTS, not percent — the design writes "pt". */
function ctrDelta(summary: SearchSummary | null): TileDelta {
  if (!summary?.previous) return {};
  const points = (summary.ctr - summary.previous.ctr) * 100;
  return {
    delta: `${points >= 0 ? "+" : "−"}${Math.abs(points).toFixed(1)}pt`,
    deltaTone: points >= 0 ? "success" : "danger",
  };
}

/**
 * Position is inverted: a SMALLER number is a better rank, so a decrease is an
 * improvement and gets the success tone plus an up arrow.
 */
function positionDelta(summary: SearchSummary | null): TileDelta {
  if (!summary?.previous) return {};
  const change = summary.previous.position - summary.position;
  if (Math.abs(change) < 0.05) return {};
  const improved = change > 0;
  return {
    delta: `${improved ? "↑" : "↓"} ${Math.abs(change).toFixed(1)}`,
    deltaTone: improved ? "success" : "danger",
  };
}
