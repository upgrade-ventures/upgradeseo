import { Icon } from "@/client/components/icons/IconSprite";
import { AccountMenu } from "@/client/layout/AccountMenu";

/**
 * The shell's topbar, in the design's two forms.
 *
 * Both are 44px tall and sit on `--surface` above a hairline `--line`. The wide
 * bar carries the breadcrumb and a 320px search trigger; the narrow one
 * collapses to hamburger + brand + crumb + a search icon. They are mutually
 * exclusive, never both mounted.
 *
 * The design also puts a notifications bell here, driven by three fixture rows.
 * There is no notification source in the app, so it is left out rather than
 * shipped as a bell that opens invented alerts.
 */

const BAR_BASE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 44,
  borderBottom: "1px solid var(--line)",
  background: "var(--surface)",
  flexShrink: 0,
};

/** Small square control used for the hamburger, mobile search and the bell. */
const SQUARE_BUTTON: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--text-2)",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
};

export function ShellHeaderWide({
  siteLabel,
  crumb,
  onOpenPalette,
  accountEmail,
}: {
  /** The project's own domain, shown as the breadcrumb root. */
  siteLabel: string | null;
  crumb: string | null;
  onOpenPalette: () => void;
  /** Signed-in address for the top-right account control. */
  accountEmail: string | undefined;
}) {
  return (
    <header style={{ ...BAR_BASE, gap: 10, padding: "0 16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          color: "var(--text-3)",
          minWidth: 0,
        }}
      >
        {siteLabel ? (
          <>
            <span style={{ color: "var(--text-2)" }} data-ph-mask>
              {siteLabel}
            </span>
            <span>/</span>
          </>
        ) : null}
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{crumb}</span>
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        className="prominence-search-trigger"
        aria-label="Search"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Icon name="i-search" size={14} />
        <span style={{ flex: 1 }}>Search keywords, pages, domains…</span>
        <kbd className="prominence-kbd">⌘K</kbd>
      </button>

      <AccountMenu email={accountEmail} />
    </header>
  );
}

export function ShellHeaderNarrow({
  crumb,
  drawerOpen,
  onOpenDrawer,
  onOpenPalette,
  accountEmail,
}: {
  crumb: string | null;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onOpenPalette: () => void;
  /** Signed-in address for the top-right account control. */
  accountEmail: string | undefined;
}) {
  return (
    <div style={{ ...BAR_BASE, gap: 9, padding: "0 12px" }}>
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open navigation"
        aria-expanded={drawerOpen}
        className="prominence-icon-button"
        style={{ ...SQUARE_BUTTON, width: 30, height: 30 }}
      >
        {/* Drawn inline rather than from the sprite: the design's hamburger is
            the one glyph it never added to the symbol set. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M2.5 4.5h11" />
          <path d="M2.5 8h11" />
          <path d="M2.5 11.5h11" />
        </svg>
      </button>

      <span style={{ fontSize: 14, fontWeight: 700 }}>UpgradeSEO</span>
      {crumb ? (
        <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
          / {crumb}
        </span>
      ) : null}

      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Search"
        className="prominence-icon-button"
        style={{ ...SQUARE_BUTTON, marginLeft: "auto", width: 30, height: 30 }}
      >
        <Icon name="i-search" size={15} />
      </button>

      <AccountMenu email={accountEmail} />
    </div>
  );
}
