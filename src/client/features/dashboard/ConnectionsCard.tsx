import { Link } from "@tanstack/react-router";
import type { DashboardActivation } from "@/server/features/dashboard/services/DashboardService";

/**
 * The design's "Data sources for <site>" card.
 *
 * One row per source, each showing what it is actually connected to. The design
 * carries a "Reconnect" button on an expiring Search Console grant; the app has
 * no expiry signal on the connection row, so the action is "Connect" when a
 * source is off and nothing when it is healthy — rather than a button that
 * implies an expiry we cannot see.
 *
 * Note the card declares no background, so rows sit on --canvas. That is the
 * design's choice and it is what separates this card from the Overview ones.
 */
export function ConnectionsCard({
  projectId,
  activation,
}: {
  projectId: string;
  activation: DashboardActivation;
}) {
  const rows: ConnectionRowProps[] = [
    {
      name: "Google Search Console",
      connected: activation.gsc.connected,
      meta: activation.gsc.connected
        ? (activation.gsc.siteUrl ?? "Connected")
        : "Not connected. Your real Google clicks, impressions and positions.",
      action: activation.gsc.connected ? null : (
        <Link
          to="/p/$projectId/search-performance"
          params={{ projectId }}
          search={{}}
          className="prominence-connect-button"
        >
          Connect
        </Link>
      ),
    },
    {
      name: "Google Analytics 4",
      connected: activation.ga4.connected,
      meta: activation.ga4.connected
        ? (activation.ga4.propertyDisplayName ?? "Connected")
        : "Not connected. Sessions and conversions for your organic landing pages.",
      action: null,
    },
    {
      name: "AI agent (MCP)",
      connected: Boolean(activation.mcp.firstToolCallAt),
      meta: activation.mcp.firstToolCallAt
        ? "Connected. Your agent can read this project."
        : activation.mcp.authorizedAt
          ? "Authorized, but no tool call yet."
          : "Not connected. Use UpgradeSEO from Claude, Cursor or Codex.",
      action: activation.mcp.firstToolCallAt ? null : (
        <Link to="/ai" className="prominence-connect-button">
          Set up
        </Link>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 760, padding: "18px var(--pad, 24px)" }}>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "9px 12px",
            background: "var(--subtle)",
            borderBottom: "1px solid var(--line)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Data sources for {activation.domain ?? "this project"}
        </div>
        {rows.map((row, index) => (
          <ConnectionRow
            key={row.name}
            {...row}
            last={index === rows.length - 1}
          />
        ))}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-2)" }}>
        Provider keys and account-wide settings live in{" "}
        <Link to="/settings">Settings</Link>.
      </p>
    </div>
  );
}

type ConnectionRowProps = {
  name: string;
  connected: boolean;
  meta: string;
  action: React.ReactNode;
};

function ConnectionRow({
  name,
  connected,
  meta,
  action,
  last,
}: ConnectionRowProps & { last: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "11px 12px",
        borderBottom: last ? undefined : "1px solid var(--border-muted)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: connected ? "var(--success)" : "var(--text-3)",
          marginTop: 5,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>{meta}</div>
      </div>
      {action}
    </div>
  );
}
