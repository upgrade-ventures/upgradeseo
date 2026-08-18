import { BacklinksDataTable, type BacklinksColumn } from "./BacklinksDataTable";
import type { AnchorRow } from "./backlinksAnchors";

const columns: BacklinksColumn<AnchorRow>[] = [
  {
    key: "anchor",
    header: "Anchor text",
    variant: "name",
    help: "The clickable text used by the links pointing at the target.",
    render: (row) => row.anchor,
  },
  {
    key: "backlinks",
    header: "Backlinks",
    variant: "text",
    help: "Links counted with this anchor text.",
    render: (row) => row.backlinks.toLocaleString(),
  },
  {
    key: "share",
    header: "Share",
    variant: "text",
    help: "Share of the counted links, not of the whole link profile.",
    render: (row) => `${Math.round(row.share)}%`,
  },
];

/**
 * Anchors are grouped on the client from the links Bing Webmaster Tools
 * reports, so the table is a count of what we hold. The caller states that
 * basis beneath it; the share column is a share of that count.
 */
export function AnchorsTable({
  rows,
  loading,
}: {
  rows: AnchorRow[];
  loading: boolean;
}) {
  return (
    <BacklinksDataTable
      caption="Anchors"
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.anchor}
      loading={loading}
      emptyLabel="No anchor text in the links reported for this target."
    />
  );
}
