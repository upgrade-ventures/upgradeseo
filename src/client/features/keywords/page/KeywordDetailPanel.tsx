import { useNavigate } from "@tanstack/react-router";
import { AreaTrendChart } from "@/client/features/keywords/components";
import { ExportToSheetsButton } from "@/client/components/table/ExportToSheetsButton";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { LOCATIONS, formatNumber } from "@/client/features/keywords/utils";
import { PagerButton, Skeleton, useFocusRing } from "./prominenceControls";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
  projectId: string;
  /** Below the design's 1140px breakpoint the panel stacks under the table. */
  stacked: boolean;
};

const SECTION: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--line)",
};

const EYEBROW: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: ".06em",
  color: "var(--text-3)",
  fontWeight: 700,
};

const METRIC_VALUE: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  letterSpacing: ".01em",
  fontSize: 15,
  fontWeight: 600,
};

/**
 * The panel's two stacked actions. The shared primary/secondary primitives
 * already carry the design's colours, focus ring and hover; the panel only adds
 * the full-width block layout and the mobile hit-target floor.
 */
const PANEL_ACTION: React.CSSProperties = {
  width: "100%",
  minHeight: "max(28px, var(--tap, 0px))",
};

const SERP_NUMERIC: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  letterSpacing: ".01em",
  fontSize: 11.5,
};

function Unavailable({ reason }: { reason: string }) {
  return (
    <span style={{ ...METRIC_VALUE, color: "var(--text-3)" }} title={reason}>
      <span aria-hidden>—</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}

/** A ranking page. Carries the token focus ring the browser default is not. */
function SerpLink({ url, title }: { url: string; title: string }) {
  const { ring, ringProps } = useFocusRing();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      {...ringProps}
      style={{
        flex: 1,
        minWidth: 0,
        fontSize: 12.5,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        borderRadius: 4,
        ...ring,
      }}
    >
      {url}
    </a>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{label}</div>
      <div style={METRIC_VALUE}>{children}</div>
    </div>
  );
}

export function KeywordDetailPanel({ controller, projectId, stacked }: Props) {
  const navigate = useNavigate();
  const keyword = controller.overviewKeyword;

  return (
    <aside
      id="keyword-detail-panel"
      aria-label="Selected keyword"
      style={{
        borderLeft: stacked ? "none" : "1px solid var(--line)",
        borderTop: stacked ? "1px solid var(--line)" : "none",
        alignSelf: "stretch",
        minHeight: "100%",
      }}
    >
      {keyword === null ? (
        <div style={{ padding: "12px 14px" }}>
          <div style={EYEBROW}>Selected keyword</div>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            Pick a keyword in the table to see its metrics and where you rank
            for it.
          </p>
        </div>
      ) : (
        <>
          <div style={SECTION}>
            <div style={EYEBROW}>Selected keyword</div>
            <div style={{ marginTop: 5, fontSize: 15, fontWeight: 700 }}>
              {keyword.keyword}
            </div>
            <div style={{ marginTop: 3, fontSize: 12, color: "var(--text-2)" }}>
              {LOCATIONS[controller.lastSearchLocationCode] ??
                "Unknown location"}
            </div>
          </div>

          <div
            style={{
              ...SECTION,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <Metric label="Volume">
              {keyword.searchVolume === null ? (
                <Unavailable reason="No search volume reported for this keyword." />
              ) : (
                formatNumber(keyword.searchVolume)
              )}
            </Metric>
            <Metric label="Difficulty">
              {keyword.keywordDifficulty === null ? (
                <Unavailable reason="Keyword difficulty is not available from the data sources connected to this project." />
              ) : (
                keyword.keywordDifficulty
              )}
            </Metric>
            <Metric label="CPC">
              {keyword.cpc === null ? (
                <Unavailable reason="No cost-per-click reported for this keyword." />
              ) : (
                `$${keyword.cpc.toFixed(2)}`
              )}
            </Metric>
            <Metric label="Your rank">
              <YourRank controller={controller} keyword={keyword.keyword} />
            </Metric>
          </div>

          {keyword.trend.length > 0 ? (
            <div style={SECTION}>
              <div style={{ ...EYEBROW, marginBottom: 8 }}>Search trend</div>
              <AreaTrendChart trend={keyword.trend} />
            </div>
          ) : null}

          <WhoRanksNow controller={controller} keyword={keyword.keyword} />

          <div
            style={{
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <PrimaryButton
              style={PANEL_ACTION}
              onClick={() => {
                controller.setSelectedRows(new Set([keyword.keyword]));
                controller.setSaveConfirmOpen(true);
              }}
            >
              Save to a list
            </PrimaryButton>
            <SecondaryButton
              style={PANEL_ACTION}
              onClick={() =>
                void navigate({
                  to: "/p/$projectId/rank-tracking",
                  params: { projectId },
                })
              }
            >
              Track this keyword
            </SecondaryButton>
          </div>
        </>
      )}
    </aside>
  );
}

/**
 * The user's own position, which is the only ranking figure a free source can
 * report: Search Console's average position for the pages of the verified
 * property. It is never inferred, and never shown as a live SERP check.
 */
function YourRank({
  controller,
  keyword,
}: {
  controller: KeywordResearchControllerState;
  keyword: string;
}) {
  const inSync = controller.activeSerpKeyword === keyword;

  if (!inSync || controller.serpLoading) {
    return <Skeleton width={36} height={16} />;
  }
  if (controller.serpError !== null) {
    return (
      <Unavailable
        reason={`Search Console positions could not be loaded. ${controller.serpError}`}
      />
    );
  }
  const best = controller.serpResults[0];
  if (!best) {
    return (
      <Unavailable reason="Search Console reported no impressions for this query in the last 28 days, so there is no position to average." />
    );
  }
  return (
    <span title="Search Console average position over the last 28 days.">
      {best.rank}
    </span>
  );
}

function WhoRanksNow({
  controller,
  keyword,
}: {
  controller: KeywordResearchControllerState;
  keyword: string;
}) {
  const inSync = controller.activeSerpKeyword === keyword;
  const items = inSync ? controller.serpResults : [];
  const pageItems = items.slice(
    controller.serpPage * controller.SERP_PAGE_SIZE,
    (controller.serpPage + 1) * controller.SERP_PAGE_SIZE,
  );
  const totalPages = Math.ceil(items.length / controller.SERP_PAGE_SIZE);
  const loading = !inSync || controller.serpLoading;

  return (
    <div style={SECTION}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={EYEBROW}>Who ranks now</div>
        <ExportToSheetsButton
          headers={["Position", "Page"]}
          rows={items.map((item) => [item.rank, item.url])}
          feature="serp_analysis"
          iconOnly
        />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} width="100%" height={13} />
          ))}
        </div>
      ) : pageItems.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {pageItems.map((item) => (
            <div
              key={`${item.rank}-${item.url}`}
              style={{ display: "flex", gap: 8, alignItems: "baseline" }}
            >
              <span
                style={{ ...SERP_NUMERIC, color: "var(--text-3)", width: 14 }}
              >
                {item.rank}
              </span>
              <SerpLink url={item.url} title={item.title} />
            </div>
          ))}
        </div>
      ) : null}

      {totalPages > 1 && !loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            Page {controller.serpPage + 1} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <PagerButton
              disabled={controller.serpPage === 0}
              onClick={() => controller.setSerpPage(controller.serpPage - 1)}
            >
              Previous
            </PagerButton>
            <PagerButton
              disabled={controller.serpPage >= totalPages - 1}
              onClick={() => controller.setSerpPage(controller.serpPage + 1)}
            >
              Next
            </PagerButton>
          </div>
        </div>
      ) : null}

      {/* The design's closing sentence is written copy about competitor domain
          ratings. No free source returns the organic results for a keyword the
          project does not own, so the server's own description of what these
          rows are stands in for it, verbatim. */}
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-2)" }}>
        {loading
          ? "Checking Search Console for your own positions on this query."
          : (controller.serpError ??
            controller.serpQuery.data?.notice ??
            "Competitor rankings for a keyword are not available from any free source.")}
      </p>
      {!loading && controller.serpError !== null ? (
        <PagerButton
          style={{ marginTop: 8 }}
          onClick={() => void controller.serpQuery.refetch()}
        >
          Try again
        </PagerButton>
      ) : null}
    </div>
  );
}
