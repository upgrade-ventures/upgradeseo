import { Icon } from "@/client/components/icons/IconSprite";
import {
  InfoNote,
  NoValue,
  StatTile,
  StatusPill,
} from "@/client/components/prominence/Primitives";
import {
  HEAD_ROW,
  ProportionBar,
  SCROLLER,
  TD,
  TD_FIRST,
  TD_LAST,
  TD_NUM,
  TH_FIRST,
  TH_LAST,
  TH_LEFT,
  TH_RIGHT,
  ROW_LINE,
  tableStyle,
  type Competitor,
} from "@/client/features/competitors/competitorTableParts";

/**
 * The expanded panel under a competitor row: what the harvest actually found,
 * and an explicit account of the two head-to-head numbers the design shows that
 * no free source can produce.
 */
export function CompetitorDetail({
  competitor,
  harvesting,
}: {
  competitor: Competitor;
  harvesting: boolean;
}) {
  // Mentions are ranked descending, so the first row is the denominator for the
  // share bars. It compares phrases within one harvest and nothing else.
  const topMentions = competitor.phrases[0]?.count ?? 0;

  return (
    <div style={{ padding: "14px var(--pad, 24px) 18px" }}>
      {harvesting ? (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12.5,
            color: "var(--text-2)",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Icon
            name="i-refresh"
            size={13}
            style={{ animation: "spin 1s linear infinite" }}
          />
          Reading Common Crawl. This takes 8-20 seconds and sometimes times out.
          It retries automatically.
        </p>
      ) : null}

      {competitor.unavailable ? (
        // Never "no pages found": that would read as the competitor having no
        // web presence rather than as a donation-funded index being down.
        <p
          style={{
            margin: "0 0 12px",
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid var(--warning-border)",
            background: "var(--warning-soft)",
            color: "var(--warning)",
            fontSize: 12,
          }}
        >
          Could not reach Common Crawl on the last attempt. Anything below is
          from the previous harvest.
        </p>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          maxWidth: 560,
        }}
      >
        <StatTile caption="They beat you on" value={<NoValue />} />
        <StatTile caption="Domain authority" value={<NoValue />} />
      </div>
      <InfoNote>
        Neither number is measured here. Where a competitor outranks you needs a
        licensed rank index, which no free source provides. Domain authority
        comes from OpenPageRank on Domain Overview and is not read for
        competitors on this screen.
      </InfoNote>

      {competitor.markets.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div
            style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 6 }}
          >
            Publishes for{competitor.truncated ? " (at least)" : ""}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {competitor.markets.map((market) => (
              <StatusPill key={market} tone="neutral" icon="i-globe">
                {market}
              </StatusPill>
            ))}
          </div>
        </div>
      ) : competitor.harvestedAt && !competitor.unavailable ? (
        <p
          style={{ margin: "16px 0 0", fontSize: 12.5, color: "var(--text-2)" }}
        >
          No market signal in the harvested pages. Page language is the only
          signal read, so this is silence rather than a finding.
        </p>
      ) : null}

      {competitor.phrases.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div
            style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 6 }}
          >
            Top phrases their pages target
          </div>
          <div
            style={{
              ...SCROLLER,
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "var(--surface)",
            }}
          >
            <table style={tableStyle(520)}>
              <thead>
                <tr style={HEAD_ROW}>
                  <th scope="col" style={TH_FIRST}>
                    Targeted phrase
                  </th>
                  <th scope="col" style={TH_RIGHT}>
                    Mentions
                  </th>
                  <th scope="col" style={TH_LEFT}>
                    Share of top phrase
                  </th>
                  <th scope="col" style={TH_LAST}>
                    Evidence
                  </th>
                </tr>
              </thead>
              <tbody>
                {competitor.phrases.map((row, index) => (
                  <tr
                    key={row.phrase}
                    style={{
                      borderBottom:
                        index === competitor.phrases.length - 1
                          ? undefined
                          : ROW_LINE,
                    }}
                  >
                    <td style={TD_FIRST}>{row.phrase}</td>
                    <td style={TD_NUM}>{row.count}</td>
                    <td style={TD}>
                      <ProportionBar
                        pct={
                          topMentions > 0 ? (row.count / topMentions) * 100 : 0
                        }
                        label={`${row.count} of ${topMentions} mentions, against the most repeated phrase in this harvest`}
                      />
                    </td>
                    <td style={TD_LAST}>
                      <a
                        href={row.evidenceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{
                          color: "var(--accent)",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          borderRadius: 4,
                        }}
                      >
                        View page
                        <Icon name="i-external" size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p
          style={{ margin: "16px 0 0", fontSize: 12.5, color: "var(--text-2)" }}
        >
          {harvesting
            ? "Waiting for the harvest to finish."
            : competitor.harvestedAt && !competitor.unavailable
              ? "Harvested, but no targeted phrases survived the navigation filter."
              : "Not harvested yet. Run a harvest to read what this domain publishes."}
        </p>
      )}

      {competitor.crawlId ? (
        <InfoNote>
          Read from Common Crawl {competitor.crawlId}, so no request reached{" "}
          {competitor.domain}.
          {competitor.truncated
            ? " The index returned as many pages as it was asked for, so this is a lower bound."
            : ""}
        </InfoNote>
      ) : null}
    </div>
  );
}
