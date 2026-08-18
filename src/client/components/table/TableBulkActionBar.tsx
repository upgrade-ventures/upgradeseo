import { ChevronDown, Download, Loader2 } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { SELECTION_BAND } from "./tableStyles";

/**
 * The band the design puts directly above a table while rows are selected: the
 * count, the actions that apply to the selection, and Clear selection.
 *
 * `placement="inline"` is the design's own shape. `placement="fixed"` is the
 * older floating variant, kept for screens that still render this bar after
 * their table in the DOM, where rendering in flow would drop it below the page
 * rather than above the rows it describes.
 */
export function TableBulkActionBar({
  selectedCount,
  selectedLabel = "selected",
  actions,
  onClear,
  placement = "fixed",
}: {
  selectedCount: number;
  selectedLabel?: string;
  actions: ReactNode;
  onClear: () => void;
  placement?: "fixed" | "inline";
}) {
  if (selectedCount === 0) return null;

  const band = (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      style={
        placement === "fixed"
          ? {
              ...SELECTION_BAND,
              border: "1px solid var(--accent-border)",
              borderRadius: 8,
              boxShadow: "var(--shadow)",
              padding: "8px 12px",
            }
          : SELECTION_BAND
      }
    >
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {selectedCount} {selectedLabel}
      </span>
      {actions}
      <TableBulkActionButton variant="ghost" onClick={onClear} pushRight>
        Clear selection
      </TableBulkActionButton>
    </div>
  );

  if (placement === "inline") return band;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto">{band}</div>
    </div>
  );
}

const BULK_BUTTON: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 24,
  padding: "2px 9px",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const BULK_BUTTON_TONE: Record<string, CSSProperties> = {
  default: {
    border: "1px solid var(--line)",
    background: "var(--surface)",
    color: "var(--text)",
  },
  danger: {
    border: "1px solid var(--danger-border)",
    background: "var(--danger-soft)",
    color: "var(--danger)",
    fontWeight: 600,
  },
  ghost: {
    border: "none",
    background: "none",
    color: "var(--text-2)",
  },
};

export function TableBulkActionButton({
  icon,
  children,
  onClick,
  disabled,
  variant = "default",
  /** Pushes the control to the right of the band, where Clear selection sits. */
  pushRight,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger" | "ghost";
  pushRight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="prominence-bulk-button"
      style={{
        ...BULK_BUTTON,
        ...BULK_BUTTON_TONE[variant],
        ...(pushRight ? { marginLeft: "auto" } : null),
        ...(disabled ? { opacity: 0.55, cursor: "not-allowed" } : null),
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function TableBulkExportMenu({
  actions,
  busy,
}: {
  actions: Array<{
    label: ReactNode;
    icon?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }>;
  busy?: boolean;
}) {
  return (
    <div className="dropdown dropdown-top dropdown-end">
      <button
        type="button"
        tabIndex={0}
        disabled={busy}
        aria-haspopup="menu"
        // Sits inside the selection band, so it wears the band's button.
        className="prominence-bulk-button"
        style={{
          ...BULK_BUTTON,
          ...BULK_BUTTON_TONE.default,
          ...(busy ? { opacity: 0.55, cursor: "not-allowed" } : null),
        }}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        Export
        <ChevronDown className="size-3 opacity-60" />
      </button>
      <ul
        tabIndex={0}
        role="menu"
        className="dropdown-content menu z-10 mb-2 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
      >
        {actions.map((action, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={action.onClick}
              disabled={busy || action.disabled}
            >
              {action.icon}
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TableExportMenu({
  actions,
  buttonClassName = "btn btn-sm gap-1",
  menuClassName = "dropdown-content z-10 menu p-2 shadow-lg bg-base-100 border border-base-300 rounded-box w-56",
}: {
  actions: Array<{
    label: ReactNode;
    icon?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }>;
  buttonClassName?: string;
  menuClassName?: string;
}) {
  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className={buttonClassName}>
        <Download className="size-4" />
        Export
        <ChevronDown className="size-3 opacity-60" />
      </div>
      <ul tabIndex={0} className={menuClassName}>
        {actions.map((action, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.icon}
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
