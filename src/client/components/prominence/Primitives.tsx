import { Icon, type IconName } from "@/client/components/icons/IconSprite";

/**
 * Prominence primitives.
 *
 * The design has no CSS classes — every style is an inline declaration against
 * the token set. These components hold those declarations once so a screen
 * reads as structure rather than as a wall of style objects, and so a value the
 * design uses in eleven places is written down once.
 *
 * Anything with a `:hover` lives in app.css instead, since the design carries
 * hover as a `style-hover` attribute its own renderer understands and CSS does
 * not.
 */

/* ── Page header band ─────────────────────────────────────────────────────── */

/**
 * The band at the top of every screen: title, optional badge and subtitle,
 * right-aligned actions, and an optional tab strip below.
 *
 * Horizontal padding is `--pad`, which the shell tightens to 14px on narrow
 * viewports, so the band re-gutters itself without a media query here.
 */
export function PageHeaderBand({
  title,
  badge,
  subtitle,
  actions,
  tabs,
  tabsFlush = true,
}: {
  title: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  /**
   * A TabStrip is drawn sitting ON the band's bottom border — that is what
   * makes the active tab read as continuous with the panel below it, and it
   * supplies its own 14px top margin. Any other content in that slot, in
   * practice a search form, needs the same 14px as clearance BELOW it instead,
   * or the controls butt straight into the rule with a one-pixel gap.
   */
  tabsFlush?: boolean;
}) {
  return (
    <div
      style={{
        padding: `18px var(--pad, 24px) ${tabsFlush ? 0 : 14}px`,
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h1>
            {badge}
          </div>
          {subtitle ? (
            <p
              style={{
                margin: "5px 0 0",
                fontSize: 12.5,
                color: "var(--text-2)",
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div style={{ display: "flex", gap: 8 }}>{actions}</div>
        ) : null}
      </div>
      {tabs}
    </div>
  );
}

/* ── Status pill ──────────────────────────────────────────────────────────── */

export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

const PILL_TONE: Record<PillTone, { fg: string; bg: string; bd: string }> = {
  success: {
    fg: "var(--success)",
    bg: "var(--success-soft)",
    bd: "var(--success-border)",
  },
  warning: {
    fg: "var(--warning)",
    bg: "var(--warning-soft)",
    bd: "var(--warning-border)",
  },
  danger: {
    fg: "var(--danger)",
    bg: "var(--danger-soft)",
    bd: "var(--danger-border)",
  },
  info: { fg: "var(--info)", bg: "var(--info-soft)", bd: "var(--info-border)" },
  neutral: {
    fg: "var(--text-2)",
    bg: "var(--subtle)",
    bd: "var(--line)",
  },
};

/** Small pill used for status ("Tracking", "Setup required", severity counts). */
export function StatusPill({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: PillTone;
  icon?: IconName;
  children: React.ReactNode;
}) {
  const t = PILL_TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 20,
        padding: "0 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.bd}`,
      }}
    >
      {/* The design thickens the stroke to 1.8 inside pills so the glyph holds
          up against the pill's own weight. */}
      {icon ? (
        <Icon name={icon} size={12} style={{ strokeWidth: 1.8 }} />
      ) : null}
      {children}
    </span>
  );
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */

export function SecondaryButton({
  icon,
  onClick,
  disabled,
  type = "button",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="prominence-button-secondary"
      {...rest}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {icon ? <Icon name={icon} size={14} /> : null}
        {children}
      </span>
    </button>
  );
}

export function PrimaryButton({
  icon,
  onClick,
  disabled,
  type = "button",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="prominence-button-primary"
      {...rest}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {icon ? <Icon name={icon} size={14} /> : null}
        {children}
      </span>
    </button>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

/**
 * Underline tab strip. The active tab is marked with an inset bottom shadow
 * rather than a border, so switching tabs never shifts the row by a pixel.
 */
export function TabStrip({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="tablist"
      style={{ display: "flex", gap: 2, marginTop: 14, flexWrap: "wrap" }}
    >
      {children}
    </div>
  );
}

export function Tab({
  active,
  onClick,
  controls,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** id of the panel this tab controls, for aria-controls. */
  controls?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className="prominence-tab"
      style={{
        color: active ? "var(--text)" : "var(--text-2)",
        fontWeight: active ? 600 : 400,
        boxShadow: active ? "inset 0 -2px 0 var(--accent)" : "none",
      }}
    >
      {children}
    </button>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

/** Bordered section with an optional `--subtle` header strip. */
export function Card({
  title,
  count,
  note,
  headerRight,
  children,
  style,
}: {
  title?: React.ReactNode;
  /** Muted tabular count shown beside the title. */
  count?: React.ReactNode;
  /** Muted note on the right of the header. */
  note?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--surface)",
        overflow: "hidden",
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "9px 12px",
            background: "var(--subtle)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
              {title}
            </h2>
            {count != null ? (
              <span
                style={{
                  fontSize: 11,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "0.01em",
                  color: "var(--text-3)",
                }}
              >
                {count}
              </span>
            ) : null}
          </div>
          {note ? (
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{note}</span>
          ) : null}
          {headerRight}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Inline section heading with an optional right-hand link. */
export function SectionHeader({
  title,
  action,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{title}</h2>
      {action}
    </div>
  );
}

/* ── Stat tile ────────────────────────────────────────────────────────────── */

/**
 * A single metric.
 *
 * `value` is a node, not a number, so a caller with nothing to show can pass an
 * explicit unavailable marker. A tile must never invent a zero to fill itself.
 */
export function StatTile({
  caption,
  value,
  delta,
  deltaTone,
}: {
  caption: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaTone?: "success" | "danger";
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--surface)",
        padding: "11px 12px",
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{caption}</div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 3,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </span>
        {delta != null ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color:
                deltaTone === "danger" ? "var(--danger)" : "var(--success)",
            }}
          >
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The design's marker for a metric no free source can supply. */
export function NoValue() {
  return (
    <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 15 }}>
      —
    </span>
  );
}

/* ── Info note ────────────────────────────────────────────────────────────── */

export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "10px 0 0",
        fontSize: 12,
        color: "var(--text-3)",
      }}
    >
      {children}
    </p>
  );
}

/** Standard page body padding, matching the design's screen gutters. */
export function ScreenBody({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ padding: "16px var(--pad, 24px) 0", ...style }}>
      {children}
    </div>
  );
}
