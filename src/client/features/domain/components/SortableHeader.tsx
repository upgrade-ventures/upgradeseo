import { Icon } from "@/client/components/icons/IconSprite";
import { focusRing } from "@/client/features/domain/components/domainTableStyles";
import type { SortOrder } from "@/client/features/domain/types";

/**
 * A column header that sorts.
 *
 * The design draws headers as inert labels, but this screen's tables really are
 * sortable and dropping that would cost the user a working control. The button
 * inherits every typographic declaration from its `<th>`, so a sortable header
 * and a plain one are indistinguishable until the arrow appears.
 */
export function SortableHeader({
  label,
  title,
  isActive,
  order,
  align = "right",
  disabled = false,
  onClick,
}: {
  label: string;
  /** Long-form explanation, shown on hover and to assistive tech. */
  title?: string;
  isActive: boolean;
  order: SortOrder;
  align?: "left" | "right";
  /** Set when the column holds values this data source cannot order by. */
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={`Sort by ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 0,
        border: "none",
        background: "none",
        outline: "none",
        borderRadius: 3,
        font: "inherit",
        color: isActive ? "var(--text-2)" : "inherit",
        letterSpacing: "inherit",
        textTransform: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        flexDirection: align === "right" ? "row-reverse" : "row",
      }}
      {...focusRing<HTMLButtonElement>()}
    >
      <span>{label}</span>
      {isActive ? (
        <Icon
          name={order === "asc" ? "i-arrow-up" : "i-arrow-down"}
          size={11}
        />
      ) : null}
    </button>
  );
}
