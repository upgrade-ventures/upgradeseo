import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  PageHeaderBand,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@/client/components/prominence/Primitives";
import { LOCATIONS } from "@/client/features/keywords/locations";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getRankTrackingConfigSummaries,
  updateRankTrackingConfig,
} from "@/serverFunctions/rank-tracking";
import { devicesLabel, scheduleLabel } from "@/shared/rank-tracking";
import { formatLocationLabel } from "@/shared/keyword-locations";
import {
  applyDomainListFilters,
  countActiveDomainListFilters,
  DomainListFilterBar,
  EMPTY_DOMAIN_LIST_FILTERS,
  getDomainListFilterOptions,
  type DomainListFilters,
} from "./RankTrackingFilters";
import {
  Dash,
  HEAD_ROW,
  HoverRow,
  Skeleton,
  SmallButton,
  StateBand,
  TABLE,
  TABLE_SCROLLER,
  TD_GUTTER,
  TD_VALUE,
  TH_GUTTER,
  TH_VALUE,
  useInteractive,
} from "./RankScreenParts";
import { InlineConfirm } from "./RankPanelParts";
import { formatCount, formatStamp } from "./rankFormat";

type ConfigSummary = Awaited<
  ReturnType<typeof getRankTrackingConfigSummaries>
>[number];

// Below this many domains the list is short enough to scan by eye, so the
// filter controls are more chrome than help. Still shown if filters are active
// (e.g. archiving dropped the count) so they never get orphaned.
const FILTER_BAR_MIN_DOMAINS = 6;

/**
 * The tracked-domain index.
 *
 * The design draws one tracking set; this is the list that leads to it, in the
 * same table language so the two screens read as one product.
 */
export function RankTrackingDomainList({
  projectId,
  onAddDomain,
  panel,
}: {
  projectId: string;
  onAddDomain: () => void;
  /** Inline band under the header, e.g. the add-domain form. */
  panel?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [archiveTarget, setArchiveTarget] = useState<ConfigSummary | null>(
    null,
  );
  const [filters, setFilters] = useState<DomainListFilters>(
    EMPTY_DOMAIN_LIST_FILTERS,
  );
  const summaries = useQuery({
    queryKey: ["rankTrackingConfigSummaries", projectId],
    queryFn: () => getRankTrackingConfigSummaries({ data: { projectId } }),
  });

  const all = useMemo(() => summaries.data ?? [], [summaries.data]);
  const filtered = useMemo(
    () => applyDomainListFilters(all, filters),
    [all, filters],
  );
  const filterOptions = useMemo(() => getDomainListFilterOptions(all), [all]);
  const activeFilterCount = countActiveDomainListFilters(filters);

  const archiveMutation = useMutation({
    mutationFn: (configId: string) =>
      updateRankTrackingConfig({
        data: { projectId, configId, isActive: false },
      }),
    onSuccess: () => {
      setArchiveTarget(null);
      for (const key of [
        "rankTrackingConfigSummaries",
        "rankTrackingConfigs",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key, projectId] });
      }
      toast.success("Domain archived · recorded positions are kept");
    },
    onError: (error) => {
      // The row stays armed so the confirm can be retried in place.
      toast.error(getStandardErrorMessage(error, "Could not archive domain"));
    },
  });

  return (
    <div>
      <PageHeaderBand
        title="Rank Tracking"
        badge={
          summaries.isSuccess ? (
            <StatusPill tone="neutral">
              {all.length} domain{all.length === 1 ? "" : "s"}
            </StatusPill>
          ) : null
        }
        subtitle="Keyword positions per domain, measured by the checks you run."
        actions={
          <PrimaryButton onClick={onAddDomain}>Add domain</PrimaryButton>
        }
      />

      {panel}

      {all.length >= FILTER_BAR_MIN_DOMAINS || activeFilterCount > 0 ? (
        <DomainListFilterBar
          filters={filters}
          options={filterOptions}
          activeFilterCount={activeFilterCount}
          onChange={setFilters}
          onReset={() => setFilters(EMPTY_DOMAIN_LIST_FILTERS)}
        />
      ) : null}

      {summaries.isError ? (
        <StateBand
          action={
            <SecondaryButton onClick={() => void summaries.refetch()}>
              Try again
            </SecondaryButton>
          }
        >
          Could not load the tracked domains for this project.
        </StateBand>
      ) : summaries.isPending ? (
        <div style={{ padding: "12px var(--pad,24px)" }} aria-busy>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} width="100%" style={{ marginBottom: 11 }} />
          ))}
        </div>
      ) : all.length === 0 ? (
        <StateBand
          action={
            <PrimaryButton onClick={onAddDomain}>Add domain</PrimaryButton>
          }
        >
          No domains are tracked yet. Add one to start measuring keyword
          positions over time.
        </StateBand>
      ) : filtered.length === 0 ? (
        <StateBand
          action={
            <SecondaryButton
              onClick={() => setFilters(EMPTY_DOMAIN_LIST_FILTERS)}
            >
              Clear filters
            </SecondaryButton>
          }
        >
          No tracked domain matches these filters.
        </StateBand>
      ) : (
        <div style={TABLE_SCROLLER}>
          <table style={TABLE}>
            <thead>
              <tr style={HEAD_ROW}>
                <th style={TH_GUTTER}>Domain</th>
                <th style={TH_VALUE}>Keywords</th>
                <th style={{ ...TH_VALUE, textAlign: "left" }}>Location</th>
                <th style={{ ...TH_VALUE, textAlign: "left" }}>Devices</th>
                <th style={{ ...TH_VALUE, textAlign: "left" }}>Schedule</th>
                <th style={{ ...TH_VALUE, textAlign: "left" }}>Last check</th>
                <th
                  style={{
                    ...TH_VALUE,
                    textAlign: "right",
                    padding: "6px var(--pad,24px) 6px 12px",
                  }}
                >
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((summary) => (
                <Fragment key={summary.id}>
                  <HoverRow>
                    <td style={TD_GUTTER}>
                      <DomainLink projectId={projectId} summary={summary} />
                    </td>
                    <td
                      style={{
                        ...TD_VALUE,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCount(summary.keywordCount)}
                    </td>
                    <td style={{ ...TD_VALUE, textAlign: "left" }}>
                      {summary.locationName
                        ? formatLocationLabel(summary.locationName, 2)
                        : (LOCATIONS[summary.locationCode] ??
                          String(summary.locationCode))}
                    </td>
                    <td style={{ ...TD_VALUE, textAlign: "left" }}>
                      {devicesLabel(summary.devices)}
                    </td>
                    <td style={{ ...TD_VALUE, textAlign: "left" }}>
                      {scheduleLabel(summary.scheduleInterval)}
                    </td>
                    <td style={{ ...TD_VALUE, textAlign: "left" }}>
                      {summary.lastRunCompletedAt ? (
                        formatStamp(summary.lastRunCompletedAt)
                      ) : (
                        <span title="No check has completed for this domain">
                          <Dash />
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        ...TD_VALUE,
                        padding:
                          "var(--rp,5px) var(--pad,24px) var(--rp,5px) 12px",
                      }}
                    >
                      <SmallButton
                        tone="ghost"
                        onClick={() => setArchiveTarget(summary)}
                        title={`Archive ${summary.domain}`}
                        aria-expanded={archiveTarget?.id === summary.id}
                      >
                        Archive
                      </SmallButton>
                    </td>
                  </HoverRow>
                  {/* Archiving is destructive, so it arms in place under the row
                    it is about rather than in a dialog. */}
                  {archiveTarget?.id === summary.id ? (
                    <tr style={{ background: "var(--danger-soft)" }}>
                      <td
                        colSpan={7}
                        style={{
                          padding: "9px var(--pad,24px)",
                          borderBottom: "1px solid var(--danger-border)",
                        }}
                      >
                        <InlineConfirm
                          question={`Archive ${summary.domain}?`}
                          detail="Scheduled checks stop and the domain leaves this list. Recorded positions are kept."
                          confirmLabel="Archive"
                          busyLabel="Archiving…"
                          busy={archiveMutation.isPending}
                          onConfirm={() => archiveMutation.mutate(summary.id)}
                          onCancel={() => setArchiveTarget(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DomainLink({
  projectId,
  summary,
}: {
  projectId: string;
  summary: ConfigSummary;
}) {
  const { hovered, focused, interactiveProps } = useInteractive();
  return (
    <Link
      to="/p/$projectId/rank-tracking/$configId"
      params={{ projectId, configId: summary.id }}
      {...interactiveProps}
      style={{
        color: hovered ? "var(--accent)" : "var(--text)",
        textDecoration: "none",
        outline: "none",
        boxShadow: focused ? "var(--focus)" : undefined,
      }}
    >
      {summary.domain}
    </Link>
  );
}
