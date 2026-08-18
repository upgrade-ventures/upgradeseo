import { Icon } from "@/client/components/icons/IconSprite";
import { HeaderHelpLabel } from "@/client/features/keywords/components";

type SortableColumn = {
  getIsSorted: () => false | "asc" | "desc";
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined;
};

/**
 * Sort control inside a header cell.
 *
 * The button inherits the cell's own typography rather than restating it, so a
 * sortable column and a plain one read identically at 11px uppercase: the arrow
 * is the only difference between them.
 */
export function SortableHeader({
  column,
  label,
  helpText,
  align,
}: {
  column: SortableColumn;
  label: string;
  helpText?: string;
  align?: "left" | "right";
}) {
  const sorted = column.getIsSorted();
  const content = (
    <button
      type="button"
      className="prominence-sort-header"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 0,
        border: "none",
        background: "none",
        font: "inherit",
        color: "inherit",
        textTransform: "inherit",
        letterSpacing: "inherit",
        cursor: "pointer",
        borderRadius: 3,
      }}
      onClick={column.getToggleSortingHandler()}
      aria-label={`Sort by ${label}`}
      aria-pressed={!!sorted}
    >
      {helpText ? <HeaderHelpLabel label={label} helpText={helpText} /> : label}
      <Icon
        name={sorted === "asc" ? "i-arrow-up" : "i-arrow-down"}
        size={11}
        style={{ opacity: sorted ? 1 : 0.35, flexShrink: 0 }}
      />
    </button>
  );

  if (align === "right") {
    return (
      <span
        style={{ display: "flex", width: "100%", justifyContent: "flex-end" }}
      >
        {content}
      </span>
    );
  }

  return content;
}
