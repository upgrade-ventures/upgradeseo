import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import {
  InfoNote,
  NoValue,
  PageHeaderBand,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { JobStatusPill } from "@/client/components/prominence/JobStatus";
import { CompetitorAddRow } from "@/client/features/competitors/CompetitorAddRow";
import { CompetitorDetail } from "@/client/features/competitors/CompetitorDetail";
import {
  DisclosureButton,
  HeadRow,
  LoadingTable,
  ROW_LINE,
  SCROLLER,
  TD,
  TD_FIRST,
  TD_LAST,
  TD_NUM,
  tableStyle,
} from "@/client/features/competitors/competitorTableParts";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  createCompetitor,
  deleteCompetitor,
  getCompetitors,
  refreshCompetitor,
} from "@/serverFunctions/competitors";

/** Columns in the competitor table, for the detail row's colSpan. */
const COLUMN_COUNT = 6;

const SUBTITLE =
  "What each competitor targets, read from the pages they publish. Content comes from Common Crawl, so building this sends no requests to their site.";

/**
 * The row's two actions, each with its second step drawn in place.
 *
 * The design has no modal surface, so a confirmation replaces the buttons it
 * came from rather than covering the page. A harvest confirms because it is a
 * job and states its scope as work and time; a removal confirms because it is
 * destructive and says what goes with it.
 */
function RowActions({
  domain,
  harvesting,
  removing,
  confirming,
  onConfirmingChange,
  onHarvest,
  onRemove,
}: {
  domain: string;
  harvesting: boolean;
  removing: boolean;
  confirming: "harvest" | "remove" | null;
  onConfirmingChange: (action: "harvest" | "remove" | null) => void;
  onHarvest: () => void;
  onRemove: () => void;
}) {
  if (confirming) {
    const harvest = confirming === "harvest";
    return (
      <div
        role="group"
        aria-live="polite"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            // Capped, so the confirmation cannot stretch the table's last
            // column and push the whole grid sideways.
            maxWidth: 260,
            fontSize: 12,
            color: "var(--text-2)",
            textAlign: "right",
          }}
        >
          {harvest
            ? // Scope as work and time, never as a price. Both figures are the
              // harvest's real limits, not a round number.
              "Lists this domain in Common Crawl and reads 25 of its pages. About 8 to 20 seconds."
            : `Removes ${domain} and its harvest. Nothing is kept.`}
        </span>
        <SecondaryButton onClick={() => onConfirmingChange(null)}>
          Cancel
        </SecondaryButton>
        <SecondaryButton
          autoFocus
          icon={harvest ? "i-refresh" : "i-x"}
          onClick={harvest ? onHarvest : onRemove}
          style={
            harvest
              ? undefined
              : {
                  borderColor: "var(--danger-border)",
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  fontWeight: 600,
                }
          }
        >
          {harvest ? "Harvest now" : "Remove"}
        </SecondaryButton>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      <SecondaryButton
        icon="i-refresh"
        disabled={harvesting}
        onClick={() => onConfirmingChange("harvest")}
      >
        {/* No live count: the harvest is one server call that returns when it
            is done, so a progress figure here would be invented. */}
        {harvesting ? "Reading Common Crawl…" : "Harvest"}
      </SecondaryButton>
      <SecondaryButton
        icon="i-x"
        aria-label={`Remove ${domain}`}
        disabled={removing}
        onClick={() => onConfirmingChange("remove")}
      />
    </div>
  );
}

function formatHarvestedAt(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CompetitorsPage({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Both long-running and destructive actions confirm in place. The design has
  // no modal surface, so the second step is drawn in the row that raised it.
  const [confirming, setConfirming] = useState<{
    id: string;
    action: "harvest" | "remove";
  } | null>(null);

  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => getCompetitors({ data: { projectId } }),
  });

  const write = (statuses: unknown) =>
    queryClient.setQueryData(["competitors", projectId], statuses);

  const addMutation = useMutation({
    mutationFn: (value: string) =>
      createCompetitor({ data: { projectId, domain: value } }),
    onSuccess: (rows, value) => {
      write(rows);
      toast.success(`${value} added. Run a harvest to read what it publishes.`);
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const refreshMutation = useMutation({
    mutationFn: (competitorId: string) =>
      refreshCompetitor({ data: { projectId, competitorId } }),
    onSuccess: (rows, competitorId) => {
      write(rows);
      // The server call succeeding does not mean the harvest did: Common Crawl
      // failures come back as `unavailable`, and firing "Harvest complete"
      // beside the row's own "could not reach Common Crawl" alert gave two
      // contradictory signals at once.
      const harvested = rows.find((row) => row.id === competitorId);
      if (harvested?.unavailable) {
        toast.warning("Common Crawl did not respond. Try again in a moment.");
      } else {
        toast.success("Harvest complete");
      }
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (competitor: { id: string; domain: string }) =>
      deleteCompetitor({ data: { projectId, competitorId: competitor.id } }),
    onSuccess: (rows, competitor) => {
      write(rows);
      if (expandedId === competitor.id) setExpandedId(null);
      // Removing a row silently left no evidence the click did anything once
      // the row had already gone from view.
      toast.success(`${competitor.domain} removed, with its harvest.`);
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const competitors = competitorsQuery.data ?? [];

  return (
    <div style={{ padding: "0 0 48px" }}>
      <PageHeaderBand title="Competitors" subtitle={SUBTITLE} />

      <CompetitorAddRow
        existingDomains={competitors.map((competitor) => competitor.domain)}
        isAdding={addMutation.isPending}
        onAdd={(value) => addMutation.mutate(value)}
      />

      {competitorsQuery.isPending ? (
        <LoadingTable />
      ) : competitorsQuery.isError ? (
        <div style={{ padding: "16px var(--pad, 24px) 0" }}>
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--danger-border)",
              background: "var(--danger-soft)",
              color: "var(--danger)",
              fontSize: 12.5,
            }}
          >
            <span>{getStandardErrorMessage(competitorsQuery.error)}</span>
            <SecondaryButton
              icon="i-refresh"
              onClick={() => void competitorsQuery.refetch()}
              disabled={competitorsQuery.isFetching}
            >
              {competitorsQuery.isFetching ? "Retrying…" : "Retry"}
            </SecondaryButton>
          </div>
        </div>
      ) : competitors.length === 0 ? (
        <div style={{ padding: "18px var(--pad, 24px) 0" }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
            No competitors yet. Add a domain above, then run a harvest to read
            what it publishes.
          </p>
        </div>
      ) : (
        <>
          <div style={SCROLLER}>
            <table style={tableStyle(760)}>
              <HeadRow />
              <tbody>
                {competitors.map((competitor, index) => {
                  const expanded = expandedId === competitor.id;
                  const harvesting =
                    refreshMutation.isPending &&
                    refreshMutation.variables === competitor.id;
                  const removing =
                    removeMutation.isPending &&
                    removeMutation.variables?.id === competitor.id;
                  // The design leaves the last row rule-less; a row whose detail
                  // panel follows hands its rule to that panel.
                  const isLast = index === competitors.length - 1;
                  const detailId = `competitor-detail-${competitor.id}`;

                  return (
                    <Fragment key={competitor.id}>
                      <tr
                        onMouseEnter={() => setHoveredId(competitor.id)}
                        onMouseLeave={() =>
                          setHoveredId((current) =>
                            current === competitor.id ? null : current,
                          )
                        }
                        style={{
                          borderBottom:
                            isLast && !expanded ? undefined : ROW_LINE,
                          background:
                            expanded || hoveredId === competitor.id
                              ? "var(--subtle)"
                              : undefined,
                        }}
                      >
                        <td style={TD_FIRST}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <DisclosureButton
                              expanded={expanded}
                              controls={expanded ? detailId : undefined}
                              label={competitor.domain}
                              onClick={() =>
                                setExpandedId(expanded ? null : competitor.id)
                              }
                            />
                            {/* The one status vocabulary: a harvest in flight
                                is Running, and a harvest that came back empty
                                because Common Crawl did not answer is the
                                state that asks a person to look. */}
                            {harvesting ? (
                              <JobStatusPill state="running" />
                            ) : competitor.unavailable ? (
                              <JobStatusPill
                                state="needs-attention"
                                title="Common Crawl did not answer the last harvest"
                              />
                            ) : null}
                          </div>
                        </td>
                        <td style={TD_NUM}>
                          {competitor.pageCount > 0 ? (
                            // Truncated harvests stop at the index's row limit,
                            // so the count is a floor and must read as one.
                            `${competitor.pageCount}${competitor.truncated ? "+" : ""}`
                          ) : (
                            <NoValue />
                          )}
                        </td>
                        <td style={TD}>
                          {competitor.markets.length > 0 ? (
                            <span style={{ color: "var(--text-2)" }}>
                              {competitor.markets.slice(0, 2).join(", ")}
                              {competitor.markets.length > 2
                                ? ` +${competitor.markets.length - 2}`
                                : ""}
                            </span>
                          ) : (
                            <NoValue />
                          )}
                        </td>
                        <td style={TD_NUM}>
                          {competitor.phrases.length > 0 ? (
                            competitor.phrases.length
                          ) : (
                            <NoValue />
                          )}
                        </td>
                        <td style={{ ...TD_NUM, color: "var(--text-2)" }}>
                          {competitor.harvestedAt ? (
                            formatHarvestedAt(competitor.harvestedAt)
                          ) : (
                            <span style={{ color: "var(--text-3)" }}>
                              Never
                            </span>
                          )}
                        </td>
                        <td style={TD_LAST}>
                          <RowActions
                            domain={competitor.domain}
                            harvesting={harvesting}
                            removing={removing}
                            confirming={
                              confirming?.id === competitor.id
                                ? confirming.action
                                : null
                            }
                            onConfirmingChange={(action) =>
                              setConfirming(
                                action ? { id: competitor.id, action } : null,
                              )
                            }
                            onHarvest={() => {
                              setConfirming(null);
                              // Expand as well, so the progress note and the
                              // result land in view rather than off-row.
                              setExpandedId(competitor.id);
                              refreshMutation.mutate(competitor.id);
                            }}
                            onRemove={() => {
                              setConfirming(null);
                              removeMutation.mutate({
                                id: competitor.id,
                                domain: competitor.domain,
                              });
                            }}
                          />
                        </td>
                      </tr>
                      {expanded ? (
                        <tr
                          style={{
                            borderBottom: isLast ? undefined : ROW_LINE,
                            background: "var(--subtle)",
                          }}
                        >
                          <td
                            id={detailId}
                            colSpan={COLUMN_COUNT}
                            style={{ padding: 0 }}
                          >
                            <CompetitorDetail
                              competitor={competitor}
                              harvesting={harvesting}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "0 var(--pad, 24px)" }}>
            <InfoNote>
              Common Crawl shows what a competitor publishes, not where they
              rank. Nothing on this screen is a Google position.
            </InfoNote>
          </div>
        </>
      )}
    </div>
  );
}
