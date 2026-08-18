import {
  TableBulkActionBar,
  TableBulkActionButton,
} from "@/client/components/table/TableBulkActionBar";
import { Icon } from "@/client/components/icons/IconSprite";
import { useFocusRing } from "@/client/features/saved/savedParts";

/** The list panel this band's disclosure controls. */
export const SAVED_LIST_PANEL_ID = "saved-list-assign-panel";

/**
 * The selection band for the saved-keyword table.
 *
 * The design puts this band directly above the table it describes, so it is
 * rendered in flow at `placement="inline"` rather than floating over the page.
 * Every action is a plain button: a dropdown would hide two of the three
 * exports behind a second click and needs a menu surface the design does not
 * have.
 */
export function SavedBulkBar({
  selectedCount,
  exportingSelection,
  onCopy,
  onOpenTags,
  onExportCsv,
  onExportSheets,
  onDelete,
  onClear,
  listPanelOpen,
}: {
  selectedCount: number;
  exportingSelection: "csv" | "sheets" | null;
  /** Drives `aria-expanded` on the control that opens the list panel. */
  listPanelOpen: boolean;
  onCopy: () => void;
  onOpenTags: () => void;
  onExportCsv: () => void;
  onExportSheets: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;
  const exporting = exportingSelection != null;

  return (
    <TableBulkActionBar
      selectedCount={selectedCount}
      selectedLabel={`keyword${selectedCount === 1 ? "" : "s"} selected`}
      placement="inline"
      onClear={onClear}
      actions={
        <>
          {/* Its own button rather than the shared one: this control opens a
              disclosure and has to carry `aria-expanded`, which the shared
              bulk button takes no prop for. */}
          <ListPanelButton expanded={listPanelOpen} onClick={onOpenTags} />
          <TableBulkActionButton
            icon={<Icon name="i-clipboard" size={13} />}
            onClick={onCopy}
          >
            Copy
          </TableBulkActionButton>
          <TableBulkActionButton
            icon={<Icon name="i-download" size={13} />}
            onClick={onExportCsv}
            disabled={exporting}
          >
            {exportingSelection === "csv" ? "Exporting…" : "CSV"}
          </TableBulkActionButton>
          <TableBulkActionButton
            icon={<Icon name="i-external" size={13} />}
            onClick={onExportSheets}
            disabled={exporting}
          >
            {exportingSelection === "sheets" ? "Exporting…" : "Sheets"}
          </TableBulkActionButton>
          <TableBulkActionButton
            icon={<Icon name="i-x" size={13} />}
            onClick={onDelete}
            variant="danger"
          >
            Remove
          </TableBulkActionButton>
        </>
      }
    />
  );
}

/**
 * The disclosure that opens the list panel.
 *
 * The shared bulk button has no CSS rule behind its class and takes no aria
 * props, so this one carries its own geometry, its own focus ring and the
 * `aria-expanded` the panel needs.
 */
function ListPanelButton({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={SAVED_LIST_PANEL_ID}
      {...focusProps}
      className="max-sm:min-h-11"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 24,
        padding: "2px 9px",
        borderRadius: 6,
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--text)",
        fontFamily: "inherit",
        fontSize: 12,
        cursor: "pointer",
        whiteSpace: "nowrap",
        outline: "none",
        boxShadow: focusRing,
      }}
    >
      <Icon name="i-bookmark" size={13} />
      Add to list
    </button>
  );
}
