import type { RankTrackingRow } from "@/types/schemas/rank-tracking";
import {
  Dash,
  HEAD_ROW,
  HoverRow,
  SmallButton,
  TD,
  TD_NUM,
  TH,
  TH_RIGHT,
} from "./RankScreenParts";
import { InlineConfirm } from "./RankPanelParts";
import {
  KeywordButton,
  PositionCell,
  SerpFeatures,
  SortHeader,
  UrlCell,
  type SortState,
} from "./RankKeywordCellParts";
import { formatCount } from "./rankFormat";

/**
 * The keyword table's structural rows, split out so the table component is
 * state and wiring rather than 400 lines of inline style.
 */

/**
 * Accent band above the table, shown only while rows are selected.
 *
 * Removing is destructive, so it arms in place: the actions are replaced by the
 * question and its consequence, and the second click is the one that removes.
 * The design has no dialogs, so the confirm never leaves the band.
 */
export function KeywordSelectionBar({
  count,
  confirming,
  removing,
  onExportCsv,
  onExportSheets,
  onRemove,
  onConfirmRemove,
  onCancelRemove,
  onClear,
}: {
  count: number;
  confirming: boolean;
  removing: boolean;
  onExportCsv: () => void;
  onExportSheets: () => void;
  onRemove: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
  onClear: () => void;
}) {
  const keywords = `${count} keyword${count === 1 ? "" : "s"}`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px var(--pad,24px)",
        background: "var(--accent-soft)",
        borderBottom: "1px solid var(--accent-border)",
        flexWrap: "wrap",
      }}
    >
      {confirming ? (
        <InlineConfirm
          question={`Stop tracking ${keywords}?`}
          detail="Positions already recorded are kept, but these keywords leave the table and future checks."
          confirmLabel={`Remove ${keywords}`}
          busyLabel="Removing…"
          busy={removing}
          onConfirm={onConfirmRemove}
          onCancel={onCancelRemove}
        />
      ) : (
        <>
          {/* Only the count is live: a live region around the buttons would
              re-read every action label each time a row is ticked. */}
          <span role="status" style={{ fontSize: 12.5, fontWeight: 600 }}>
            {count} selected
          </span>
          <SmallButton onClick={onExportCsv}>Export CSV</SmallButton>
          <SmallButton onClick={onExportSheets}>Export to Sheets</SmallButton>
          <SmallButton tone="danger" onClick={onRemove}>
            Remove from set
          </SmallButton>
          <SmallButton
            tone="ghost"
            onClick={onClear}
            style={{ marginLeft: "auto" }}
          >
            Clear selection
          </SmallButton>
        </>
      )}
    </div>
  );
}

export function KeywordTableHead({
  sort,
  onSort,
  allSelected,
  partiallySelected,
  rowCount,
  onToggleAll,
  showDesktop,
  showMobile,
  locationName,
}: {
  sort: SortState;
  onSort: (next: SortState) => void;
  allSelected: boolean;
  partiallySelected: boolean;
  /** Rows this toggle reaches, named in its label. */
  rowCount: number;
  onToggleAll: () => void;
  showDesktop: boolean;
  showMobile: boolean;
  locationName?: string | null;
}) {
  return (
    <thead>
      <tr style={HEAD_ROW}>
        <th style={{ width: 32, padding: "6px 0 6px var(--pad,24px)" }}>
          <input
            type="checkbox"
            checked={allSelected}
            // The design has no indeterminate state, but partial selection is
            // reachable and a plain unchecked box misreports it.
            ref={(element) => {
              if (element) element.indeterminate = partiallySelected;
            }}
            onChange={onToggleAll}
            // The count is what makes this toggle's reach audible: it selects
            // the rows of this table, not every keyword in the set.
            aria-label={`Select all ${rowCount} tracked keyword${rowCount === 1 ? "" : "s"} in this table`}
            style={{ accentColor: "var(--accent)" }}
          />
        </th>
        <SortHeader sortKey="keyword" sort={sort} onSort={onSort} style={TH}>
          Keyword
        </SortHeader>
        <SortHeader
          sortKey="volume"
          sort={sort}
          onSort={onSort}
          style={TH_RIGHT}
          title={
            locationName
              ? "Monthly searches in the tracked city, from Google Ads"
              : "Monthly searches from Google Ads"
          }
        >
          {locationName ? "Local volume" : "Volume"}
        </SortHeader>
        <SortHeader
          sortKey="kd"
          sort={sort}
          onSort={onSort}
          style={TH_RIGHT}
          title="Keyword difficulty, when a source provides it"
        >
          KD
        </SortHeader>
        {showDesktop ? (
          <SortHeader
            sortKey="desktop"
            sort={sort}
            onSort={onSort}
            style={TH_RIGHT}
          >
            Desktop
          </SortHeader>
        ) : null}
        {showMobile ? (
          <SortHeader
            sortKey="mobile"
            sort={sort}
            onSort={onSort}
            style={TH_RIGHT}
          >
            Mobile
          </SortHeader>
        ) : null}
        <th style={TH}>Ranking URL</th>
        <th style={{ ...TH, padding: "6px var(--pad,24px) 6px 8px" }}>
          SERP features
        </th>
      </tr>
    </thead>
  );
}

export function KeywordRow({
  row,
  highlight,
  rowRef,
  selected,
  onToggle,
  onOpenTrend,
  showDesktop,
  showMobile,
  serpDepth,
  domain,
}: {
  row: RankTrackingRow;
  highlight: boolean;
  rowRef: (element: HTMLTableRowElement | null) => void;
  selected: boolean;
  onToggle: () => void;
  onOpenTrend: () => void;
  showDesktop: boolean;
  showMobile: boolean;
  serpDepth: number;
  domain: string;
}) {
  // The ranking URL and SERP features are one column each, so they report the
  // device the set leads with rather than silently mixing the two.
  const primary = showDesktop ? row.desktop : row.mobile;
  return (
    <HoverRow highlight={highlight} selected={selected} ref={rowRef}>
      <td style={{ padding: "var(--rp,5px) 0 var(--rp,5px) var(--pad,24px)" }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${row.keyword}`}
          style={{ accentColor: "var(--accent)" }}
        />
      </td>
      <td style={{ ...TD, fontWeight: 600 }}>
        <KeywordButton keyword={row.keyword} onClick={onOpenTrend} />
      </td>
      <td style={TD_NUM}>
        {row.searchVolume == null ? <Dash /> : formatCount(row.searchVolume)}
      </td>
      <td style={TD_NUM}>
        {row.keywordDifficulty == null ? <Dash /> : row.keywordDifficulty}
      </td>
      {showDesktop ? (
        <PositionCell result={row.desktop} serpDepth={serpDepth} />
      ) : null}
      {showMobile ? (
        <PositionCell result={row.mobile} serpDepth={serpDepth} />
      ) : null}
      <UrlCell url={primary.rankingUrl} domain={domain} />
      <td
        style={{ padding: "var(--rp,5px) var(--pad,24px) var(--rp,5px) 8px" }}
      >
        <SerpFeatures features={primary.serpFeatures} />
      </td>
    </HoverRow>
  );
}
