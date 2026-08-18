import { useQuery } from "@tanstack/react-query";
import {
  InfoNote,
  NoValue,
  SectionHeader,
  StatTile,
} from "@/client/components/prominence/Primitives";
import { getGa4OrganicOverview } from "@/serverFunctions/ga4";

/**
 * Organic behaviour from Google Analytics: what visitors did after they landed.
 *
 * Search Console stops at the click. These four tiles are the other half —
 * sessions and engagement for organic traffic only, which is why the service
 * applies an organic dimension filter rather than reporting site-wide totals.
 *
 * Three states, drawn differently on purpose:
 *  - not connected .... the section is not rendered at all, because the
 *                       Connections card already carries the connect action and
 *                       a second empty prompt on the same screen is noise
 *  - connected, empty . tiles render with an em-dash and the reason, since a
 *                       new property genuinely has nothing yet
 *  - error ............ the message from the service, not a generic failure
 *
 * A missing metric is NoValue, never 0. Zero sessions is a real measurement and
 * has to stay distinguishable from "Google returned no row".
 */
export function Ga4OrganicTiles({
  projectId,
  connected,
}: {
  projectId: string;
  connected: boolean;
}) {
  const query = useQuery({
    queryKey: ["ga4OrganicOverview", projectId],
    queryFn: () => getGa4OrganicOverview({ data: { projectId } }),
    // Nothing to ask for until a property is linked.
    enabled: connected,
    retry: false,
  });

  if (!connected) return null;

  // `current` is the summary row for the resolved window; `previous` is the
  // equal-length period before it, which the service uses for comparison.
  const totals = query.data?.current ?? null;
  const metric = (name: string): number | null => {
    const value = totals?.[name];
    return typeof value === "number" ? value : null;
  };

  const sessions = metric("sessions");
  const activeUsers = metric("activeUsers");
  const engagementRate = metric("engagementRate");
  const keyEvents = metric("keyEvents");

  return (
    <section style={{ padding: "0 var(--pad, 24px) 18px" }}>
      <SectionHeader title="Organic behaviour" />
      {query.isError ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>
          {query.error instanceof Error
            ? query.error.message
            : "Analytics could not be read."}
        </p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
            }}
          >
            <StatTile
              caption="Organic sessions"
              value={
                sessions === null ? <NoValue /> : sessions.toLocaleString()
              }
            />
            <StatTile
              caption="Active users"
              value={
                activeUsers === null ? (
                  <NoValue />
                ) : (
                  activeUsers.toLocaleString()
                )
              }
            />
            <StatTile
              caption="Engagement rate"
              value={
                engagementRate === null ? (
                  <NoValue />
                ) : (
                  `${(engagementRate * 100).toFixed(1)}%`
                )
              }
            />
            <StatTile
              caption="Key events"
              value={
                keyEvents === null ? <NoValue /> : keyEvents.toLocaleString()
              }
            />
          </div>
          <InfoNote>
            Organic traffic only, from your connected Google Analytics property.
            Search Console counts the click; these count what happened next. A
            dash means Analytics returned no figure for the window, which is not
            the same as a measured zero.
          </InfoNote>
        </>
      )}
    </section>
  );
}
