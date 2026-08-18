import { useMemo } from "react";
import {
  NoValue,
  SectionHeader,
} from "@/client/components/prominence/Primitives";
import {
  PanelFootnote,
  PanelMessage,
} from "@/client/features/audit/AuditParts";
import { NARROW_PANEL, scoreColor } from "@/client/features/audit/auditStyles";
import { extractPathname } from "@/client/features/audit/shared";
import { LighthouseRunsTable } from "@/client/features/audit/results/LighthouseRunsTable";
import {
  isLighthouseFailure,
  type PerformanceRowData,
} from "@/client/features/audit/results/AuditResultsTableFilterLogic";
import type { AuditResultsData } from "@/client/features/audit/results/types";

type ScoreKey =
  | "performanceScore"
  | "accessibilityScore"
  | "bestPracticesScore"
  | "seoScore";

const SCORE_CARDS: { key: ScoreKey; label: string }[] = [
  { key: "performanceScore", label: "Performance" },
  { key: "accessibilityScore", label: "Accessibility" },
  { key: "bestPracticesScore", label: "Best practices" },
  { key: "seoScore", label: "SEO" },
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function PerformancePanel({
  auditId,
  projectId,
  lighthouse,
  pages,
}: {
  auditId: string;
  projectId: string;
  lighthouse: AuditResultsData["lighthouse"];
  pages: AuditResultsData["pages"];
}) {
  const rows = useMemo<PerformanceRowData[]>(
    () =>
      lighthouse.map((result) => {
        const page = pages.find((candidate) => candidate.id === result.pageId);
        const pageUrl = page?.url ?? null;
        return {
          ...result,
          pageUrl,
          pagePath: pageUrl ? extractPathname(pageUrl) : null,
        };
      }),
    [lighthouse, pages],
  );

  const measured = useMemo(
    () => rows.filter((row) => !isLighthouseFailure(row)),
    [rows],
  );

  const medians = useMemo(() => {
    const result: Partial<Record<ScoreKey, number | null>> = {};
    for (const { key } of SCORE_CARDS) {
      result[key] = median(
        measured
          .map((row) => row[key])
          .filter((value): value is number => value != null),
      );
    }
    return result;
  }, [measured]);

  const scoredPageCount = useMemo(
    () =>
      new Set(
        measured
          .filter((row) => row.performanceScore != null)
          .map((row) => row.pageId),
      ).size,
    [measured],
  );

  const slowest = useMemo(
    () =>
      measured
        .filter(
          (row): row is typeof row & { lcpMs: number } => row.lcpMs != null,
        )
        .toSorted((a, b) => b.lcpMs - a.lcpMs)
        .slice(0, 3),
    [measured],
  );

  if (lighthouse.length === 0) {
    return (
      <PanelMessage title="Lighthouse did not run for this crawl.">
        Performance scores come from Google PageSpeed Insights, which is only
        called when a crawl is started with Lighthouse enabled. Start a new
        crawl with Lighthouse to fill this tab.
      </PanelMessage>
    );
  }

  return (
    <>
      <div style={NARROW_PANEL}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          {SCORE_CARDS.map(({ key, label }) => (
            <ScoreCard
              key={key}
              label={label}
              score={medians[key] ?? null}
              caption={
                key === "performanceScore"
                  ? `median of ${scoredPageCount.toLocaleString()} ${
                      scoredPageCount === 1 ? "page" : "pages"
                    }`
                  : "median"
              }
            />
          ))}
        </div>

        <div
          style={{
            marginTop: 14,
            border: "1px solid var(--line)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "9px 12px",
              background: "var(--subtle)",
              borderBottom: "1px solid var(--line)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Slowest pages
          </div>
          {slowest.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: "12px",
                fontSize: 12.5,
                color: "var(--text-2)",
              }}
            >
              No page in this crawl returned a Largest Contentful Paint
              measurement.
            </p>
          ) : (
            slowest.map((row, index) => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderBottom:
                    index === slowest.length - 1
                      ? undefined
                      : "1px solid var(--border-muted)",
                  fontSize: 12.5,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={row.pageUrl ?? undefined}
                >
                  {row.pagePath ?? row.pageUrl ?? "Unknown URL"}
                </span>
                <span
                  style={{
                    color: "var(--text-2)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {(row.lcpMs / 1000).toFixed(1)}s LCP
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      row.performanceScore == null
                        ? "var(--text-3)"
                        : scoreColor(row.performanceScore),
                  }}
                >
                  {row.performanceScore ?? <NoValue />}
                </span>
              </div>
            ))
          )}
        </div>

        <PanelFootnote>
          Scores come from Google PageSpeed Insights lab runs, so treat them as
          comparable to each other rather than to the field data in Search
          Console.
        </PanelFootnote>

        <div style={{ marginTop: 18 }}>
          <SectionHeader title="Every Lighthouse run" />
        </div>
      </div>

      <LighthouseRunsTable
        auditId={auditId}
        projectId={projectId}
        rows={rows}
      />
    </>
  );
}

/**
 * One median category score.
 *
 * The design omits `font-variant-numeric` here even though the issue summary
 * numbers carry it. Reproduced as authored.
 */
function ScoreCard({
  label,
  score,
  caption,
}: {
  label: string;
  score: number | null;
  caption: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "11px 12px",
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{label}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: score == null ? undefined : scoreColor(score),
        }}
      >
        {score ?? <NoValue />}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
        {score == null ? "not measured" : caption}
      </div>
    </div>
  );
}
