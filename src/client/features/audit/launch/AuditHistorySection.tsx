import { useState } from "react";
import {
  PanelMessage,
  Skeleton,
  SmallGhostButton,
} from "@/client/features/audit/AuditParts";
import {
  BODY_ROW,
  DATA_TABLE,
  HEAD_ROW,
  rowHoverHandlers,
  TABLE_SCROLL,
  TD_LEAD,
  TD_VALUE,
  TH_LEAD,
  TH_NUMERIC,
} from "@/client/features/audit/auditStyles";
import {
  CrawlStatusPill,
  extractHostname,
  formatAuditRef,
  formatStartedAt,
} from "@/client/features/audit/shared";
import type { AuditHistoryRow } from "@/client/features/audit/results/useCrawlComparison";

export function AuditHistorySection({
  history,
  isLoading,
  onOpen,
  onDelete,
}: {
  history: AuditHistoryRow[];
  isLoading: boolean;
  onOpen: (auditId: string) => void;
  onDelete: (auditId: string) => void;
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px var(--pad, 24px)",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          background: "var(--subtle)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
          Previous crawls
        </h2>
        {!isLoading ? (
          <span
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {history.length.toLocaleString()}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div style={{ padding: "14px var(--pad, 24px)" }}>
          <Skeleton width="46%" height={12} />
          <Skeleton width="62%" height={12} style={{ marginTop: 10 }} />
          <Skeleton width="38%" height={12} style={{ marginTop: 10 }} />
        </div>
      ) : history.length === 0 ? (
        <PanelMessage title="No crawls yet.">
          Enter the site URL above and start the first one.
        </PanelMessage>
      ) : (
        <div style={TABLE_SCROLL}>
          <table style={DATA_TABLE}>
            <thead>
              <tr style={HEAD_ROW}>
                <th scope="col" style={TH_LEAD}>
                  Crawl
                </th>
                <th scope="col" style={{ ...TH_NUMERIC, textAlign: "left" }}>
                  Started
                </th>
                <th scope="col" style={{ ...TH_NUMERIC, textAlign: "left" }}>
                  Status
                </th>
                <th scope="col" style={TH_NUMERIC}>
                  Pages
                </th>
                <th scope="col" style={TH_NUMERIC}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((crawl) => (
                <tr key={crawl.id} style={BODY_ROW} {...rowHoverHandlers}>
                  <td style={TD_LEAD}>
                    <span title={crawl.id}>{formatAuditRef(crawl.id)}</span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontWeight: 400,
                        color: "var(--text-2)",
                      }}
                      title={crawl.startUrl}
                    >
                      {extractHostname(crawl.startUrl)}
                    </span>
                  </td>
                  <td style={{ ...TD_VALUE, textAlign: "left" }}>
                    {formatStartedAt(crawl.startedAt)}
                  </td>
                  <td style={{ ...TD_VALUE, textAlign: "left" }}>
                    <CrawlStatusPill status={crawl.status} />
                  </td>
                  <td style={TD_VALUE}>
                    {crawl.pagesCrawled.toLocaleString()}
                    {crawl.ranLighthouse ? (
                      <span
                        style={{ marginLeft: 6, color: "var(--text-3)" }}
                        title="Lighthouse ran for this crawl"
                      >
                        LH
                      </span>
                    ) : null}
                  </td>
                  <td style={{ ...TD_VALUE, whiteSpace: "nowrap" }}>
                    <RowActions
                      crawlRef={formatAuditRef(crawl.id)}
                      onOpen={() => onOpen(crawl.id)}
                      onDelete={() => onDelete(crawl.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/**
 * The row's own actions.
 *
 * Deleting a crawl throws away every page and issue it recorded, so it asks
 * first. The question is asked in place, as a second step on the same row: the
 * design carries no dialog anywhere, and a confirm that stays next to the row
 * it is about cannot be misread as being about a different one.
 */
function RowActions({
  crawlRef,
  onOpen,
  onDelete,
}: {
  crawlRef: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span
        role="group"
        aria-label={`Delete crawl ${crawlRef}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <span style={{ color: "var(--text)", whiteSpace: "nowrap" }}>
          Delete {crawlRef} and its results?
        </span>
        <SmallGhostButton
          onClick={() => {
            setConfirming(false);
            onDelete();
          }}
        >
          Delete
        </SmallGhostButton>
        <SmallGhostButton muted onClick={() => setConfirming(false)}>
          Keep
        </SmallGhostButton>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <SmallGhostButton onClick={onOpen} title={`Open crawl ${crawlRef}`}>
        Open
      </SmallGhostButton>
      <SmallGhostButton
        muted
        onClick={() => setConfirming(true)}
        title={`Delete crawl ${crawlRef}`}
      >
        Delete
      </SmallGhostButton>
    </span>
  );
}
