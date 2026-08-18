import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { NoValue } from "@/client/components/prominence/Primitives";
import {
  BacklinksDataTable,
  type BacklinksColumn,
  type BacklinksTableSort,
} from "./BacklinksDataTable";
import type { TopPageRow } from "./backlinksPageTypes";
import type {
  BacklinksSortOrder,
  TopPagesSortField,
} from "@/types/schemas/backlinks";
import { formatNumber, truncateMiddle } from "./backlinksPageUtils";

const columns: BacklinksColumn<TopPageRow>[] = [
  {
    key: "page",
    header: "Your page",
    variant: "name",
    help: "Page on the target site receiving backlinks.",
    render: (row) =>
      row.page ? (
        <SafeExternalLink
          url={row.page}
          label={truncateMiddle(row.page, 72)}
          className="link link-hover break-all inline-flex items-center gap-1"
        />
      ) : (
        <NoValue />
      ),
  },
  {
    key: "referringDomains",
    header: "Referring domains",
    variant: "text",
    help: "Bing Webmaster Tools counts links per page, never the distinct domains behind them.",
    render: (row) =>
      row.referringDomains == null ? (
        <NoValue />
      ) : (
        formatNumber(row.referringDomains)
      ),
  },
  {
    key: "backlinks",
    header: "Backlinks",
    variant: "text",
    sortField: "backlinks" satisfies TopPagesSortField,
    help: "Inbound links Bing Webmaster Tools reports for this page.",
    render: (row) =>
      row.backlinks == null ? <NoValue /> : formatNumber(row.backlinks),
  },
];

export function TopPagesTable({
  rows,
  sort,
  onSortChange,
  loading,
}: {
  rows: TopPageRow[];
  sort: BacklinksTableSort;
  onSortChange: (field: string, order: BacklinksSortOrder) => void;
  loading: boolean;
}) {
  return (
    <BacklinksDataTable
      caption="Top pages"
      columns={columns}
      rows={rows}
      getRowKey={(row, index) => row.page ?? `row-${index}`}
      sort={sort}
      onSortChange={onSortChange}
      loading={loading}
      emptyLabel="No pages match this filter."
    />
  );
}
