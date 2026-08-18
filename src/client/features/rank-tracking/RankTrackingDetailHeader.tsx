import type { KeyboardEvent } from "react";
import {
  PageHeaderBand,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  Tab,
  TabStrip,
} from "@/client/components/prominence/Primitives";
import {
  JobStatusPill,
  runJobState,
} from "@/client/components/prominence/JobStatus";
import { LOCATIONS } from "@/client/features/keywords/locations";
import { devicesLabel, scheduleLabel } from "@/shared/rank-tracking";
import { formatLocationLabel } from "@/shared/keyword-locations";
import { formatCount, formatStamp } from "./rankFormat";
import { Spinner } from "./RankScreenParts";
import { MoreMenu } from "./ToolbarMenus";
import type { RankTrackingConfig } from "@/types/schemas/rank-tracking";
import type { RankLatestRun, RankTab } from "./rankTypes";

const TABS: { id: RankTab; label: string }[] = [
  { id: "keywords", label: "Keywords" },
  { id: "history", label: "History" },
  { id: "competitors", label: "Competitors" },
  { id: "activity", label: "Activity" },
];

/**
 * The screen header: what this set is, what the checker is doing right now,
 * and the four tabs.
 *
 * The design's idle pill reads "Check queued" whether or not anything was ever
 * queued. Here the pill reports the run state the database actually holds —
 * pending, running, failed, never run, or the next scheduled check — because a
 * tracker that misreports its own freshness is the one thing this screen must
 * not do.
 */
export function RankTrackingDetailHeader({
  config,
  keywordCount,
  keywordCountKnown,
  lastCheckedAt,
  latestRun,
  isChecking,
  checkBusy,
  activeTab,
  onTabChange,
  onBack,
  onEdit,
  onAddKeywords,
  addKeywordsOpen,
  onCheck,
  onRefreshMetrics,
  metricsRefreshing,
}: {
  config: RankTrackingConfig;
  keywordCount: number;
  /** False while the results query is in flight: no count beats a wrong one. */
  keywordCountKnown: boolean;
  lastCheckedAt: string | null;
  latestRun: RankLatestRun;
  isChecking: boolean;
  checkBusy: boolean;
  activeTab: RankTab;
  onTabChange: (tab: RankTab) => void;
  onBack: () => void;
  onEdit: () => void;
  onAddKeywords: () => void;
  /** Whether the add-keywords panel below the header is open. */
  addKeywordsOpen: boolean;
  onCheck: () => void;
  onRefreshMetrics: () => void;
  metricsRefreshing: boolean;
}) {
  const location = config.locationName
    ? formatLocationLabel(config.locationName, 2)
    : (LOCATIONS[config.locationCode] ?? String(config.locationCode));

  const subtitle = [
    location,
    devicesLabel(config.devices),
    `${scheduleLabel(config.scheduleInterval)} checks`,
    keywordCountKnown ? `${formatCount(keywordCount)} keywords` : null,
    lastCheckedAt
      ? `last checked ${formatStamp(lastCheckedAt)}`
      : "never checked",
  ]
    .filter(Boolean)
    .join(" · ");

  // Arrow keys move between tabs, which role="tablist" implies and the design
  // never wired. Selection follows focus, the pattern for panels this cheap.
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === activeTab);
    const next = TABS[(index + step + TABS.length) % TABS.length];
    onTabChange(next.id);
    const buttons =
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[TABS.indexOf(next)]?.focus();
  };

  return (
    <PageHeaderBand
      title={config.domain}
      badge={<RunPill config={config} latestRun={latestRun} />}
      subtitle={subtitle}
      actions={
        // One wrapping flex child rather than four siblings: the band's own
        // action row does not wrap, and four buttons overflow a phone.
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <SecondaryButton onClick={onBack}>All domains</SecondaryButton>
          <MoreMenu
            onConfigure={onEdit}
            onRefreshMetrics={onRefreshMetrics}
            metricsRefreshing={metricsRefreshing}
            hasData={keywordCount > 0}
          />
          <SecondaryButton
            onClick={onAddKeywords}
            aria-expanded={addKeywordsOpen}
          >
            Add keywords
          </SecondaryButton>
          {isChecking ? (
            <PrimaryButton
              disabled
              style={{ cursor: "progress", opacity: 0.9 }}
              aria-live="polite"
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
              >
                {/* Inherits the primary button's own label colour, so the ring
                    stays legible on the accent fill in both themes. */}
                <Spinner size={11} color="currentColor" />
                {checkingLabel(latestRun)}
              </span>
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={onCheck}
              disabled={checkBusy || keywordCount === 0}
              title={
                keywordCount === 0
                  ? "Add keywords before running a check"
                  : undefined
              }
            >
              Check ranks now
            </PrimaryButton>
          )}
        </div>
      }
      tabs={
        <div onKeyDown={onTabKeyDown}>
          <TabStrip>
            {TABS.map((tab) => (
              <Tab
                key={tab.id}
                active={activeTab === tab.id}
                controls={`rank-panel-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </Tab>
            ))}
          </TabStrip>
        </div>
      }
    />
  );
}

/**
 * A running job reports "a count of what is done so far", not the size of the
 * work. The two counts are only collapsed into one number while the run is
 * still queued and nothing has been checked yet.
 */
function checkingLabel(latestRun: RankLatestRun): string {
  if (!latestRun || latestRun.keywordsTotal <= 0) return "Checking…";
  const total = formatCount(latestRun.keywordsTotal);
  if (latestRun.status === "pending") return `Queued · ${total} keywords`;
  return `Checking ${formatCount(latestRun.keywordsChecked)} of ${total}…`;
}

/**
 * The check's state, in the product's one status vocabulary.
 *
 * The five words mean the same thing here as on Site Audit, so this pill says
 * Queued / Running / Finished / Needs attention / Failed and nothing else. A
 * completed run that recorded an error message finished without doing all of
 * the work, which is the definition of Needs attention.
 *
 * "No checks yet" and the schedule pill are not job states: no job exists in
 * the first case, and the second is when the next one is due. They stay neutral
 * pills so they can never be mistaken for one of the five.
 */
function RunPill({
  config,
  latestRun,
}: {
  config: RankTrackingConfig;
  latestRun: RankLatestRun;
}) {
  if (!latestRun) {
    return <StatusPill tone="neutral">No checks yet</StatusPill>;
  }

  const state = runJobState(latestRun.status, {
    needsAttention: Boolean(latestRun.errorMessage),
  });
  const nextCheckAt =
    state === "finished" && config.scheduleInterval !== "manual"
      ? config.nextCheckAt
      : null;

  return (
    <>
      {state === "queued" || state === "running" ? <Spinner size={9} /> : null}
      <JobStatusPill
        state={state}
        title={latestRun.errorMessage ?? undefined}
      />
      {nextCheckAt ? (
        <StatusPill tone="neutral">
          Next check {formatStamp(nextCheckAt)}
        </StatusPill>
      ) : null}
    </>
  );
}
