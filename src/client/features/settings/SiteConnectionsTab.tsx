import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { startGoogleLink } from "@/client/features/integrations/startGoogleLink";
import {
  formatDay,
  QuietNote,
  ROW_LINE,
  SkeletonBar,
  StatusDot,
  type DotTone,
} from "@/client/features/settings/settingsParts";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { disconnectGa4, getGa4Connection } from "@/serverFunctions/ga4";
import { disconnectGsc, getGscConnection } from "@/serverFunctions/gsc";
import { getProviderKeys } from "@/serverFunctions/providerKeys";

/** Where Google returns the user after an incremental grant. */
const SETTINGS_PATH = "/settings";

/**
 * Connection health for one site.
 *
 * Everything here is measured: whether a connection row exists, which account
 * and property it points at, and whether the signed-in user still holds a
 * Google grant. The design also shows a last-sync time and an access expiry
 * date; nothing in this app records either, so the rows say when the
 * connection was made instead of inventing a freshness claim.
 */
export function SiteConnectionsTab({
  projectId,
  onOpenProviderKey,
}: {
  projectId: string;
  onOpenProviderKey: (provider: string) => void;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<"gsc" | "ga4" | null>(null);

  const gscQuery = useQuery({
    queryKey: ["gscConnection", projectId],
    queryFn: () => getGscConnection({ data: { projectId } }),
  });
  const ga4Query = useQuery({
    queryKey: ["ga4Connection", projectId],
    queryFn: () => getGa4Connection({ data: { projectId } }),
  });
  const keysQuery = useQuery({
    queryKey: ["providerKeys"],
    queryFn: () => getProviderKeys(),
  });

  const disconnectGscMutation = useMutation({
    mutationFn: () => disconnectGsc({ data: { projectId } }),
    onSuccess: async () => {
      setConfirming(null);
      await queryClient.invalidateQueries({
        queryKey: ["gscConnection", projectId],
      });
      toast.success("Search Console disconnected · reports keep past data");
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const disconnectGa4Mutation = useMutation({
    mutationFn: () => disconnectGa4({ data: { projectId } }),
    onSuccess: async () => {
      setConfirming(null);
      await queryClient.invalidateQueries({
        queryKey: ["ga4Connection", projectId],
      });
      toast.success("Analytics disconnected · reports keep past data");
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (gscQuery.isPending || ga4Query.isPending) {
    return (
      <div aria-hidden>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            style={{
              display: "flex",
              gap: 10,
              padding: "11px 13px",
              borderBottom: row === 2 ? undefined : ROW_LINE,
            }}
          >
            <SkeletonBar width={7} height={7} />
            <div style={{ flex: 1, display: "grid", gap: 6 }}>
              <SkeletonBar width={170} height={11} />
              <SkeletonBar width="70%" height={9} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (gscQuery.isError || ga4Query.isError) {
    return (
      <div style={{ padding: "11px 13px" }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
          {getStandardErrorMessage(
            gscQuery.error ?? ga4Query.error,
            "We could not read this site's connections.",
          )}
        </p>
        <div style={{ marginTop: 9 }}>
          <SecondaryButton
            onClick={() => {
              void gscQuery.refetch();
              void ga4Query.refetch();
            }}
          >
            Try again
          </SecondaryButton>
        </div>
      </div>
    );
  }

  const gsc = gscQuery.data;
  const ga4 = ga4Query.data;
  const bing = keysQuery.data?.find((status) => status.provider === "bing");
  const bingConfigured = Boolean(
    bing?.configuredByOrganization || bing?.configuredByEnvironment,
  );

  const gscHealth = googleHealth({
    connected: gsc.connected,
    hasGrant: gsc.currentUserHasGrant,
    oauthConfigured: gsc.googleOAuthConfigured,
  });
  const ga4Health = googleHealth({
    connected: ga4.connected,
    hasGrant: ga4.currentUserHasGrant,
    oauthConfigured: ga4.googleOAuthConfigured,
  });

  return (
    <div>
      <ConnectionRow
        title="Google Search Console"
        health={gscHealth}
        lines={[
          gsc.connected
            ? [
                gsc.connectedByEmail
                  ? `Connected as ${gsc.connectedByEmail}`
                  : "Connected",
                gsc.siteUrl,
                formatDay(gsc.connectedAt)
                  ? `connected ${formatDay(gsc.connectedAt)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Clicks, impressions and positions for pages on this site. This is the one source that reports your own Google performance.",
          gscHealth === "reconnect"
            ? "Your Google access needs renewing. Reports show the data we already pulled until you reconnect."
            : gscHealth === "setup"
              ? "This server has no Google OAuth client yet, so the connection cannot start. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment and restart. See the free setup guide for the exact steps."
              : null,
        ]}
        action={
          <ConnectionAction
            projectId={projectId}
            provider="gsc"
            hash="search-console"
            health={gscHealth}
            confirming={confirming === "gsc"}
            pending={disconnectGscMutation.isPending}
            onAskDisconnect={() => setConfirming("gsc")}
            onCancelDisconnect={() => setConfirming(null)}
            onDisconnect={() => disconnectGscMutation.mutate()}
          />
        }
      />

      <ConnectionRow
        title="Google Analytics 4"
        health={ga4Health}
        lines={[
          ga4.connected
            ? [
                ga4.propertyDisplayName
                  ? `Property “${ga4.propertyDisplayName}”`
                  : ga4.propertyId,
                ga4.connectedByEmail ? `as ${ga4.connectedByEmail}` : null,
                formatDay(ga4.connectedAt)
                  ? `connected ${formatDay(ga4.connectedAt)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Sessions and conversions next to your search data. Optional, and nothing breaks without it.",
          ga4Health === "reconnect"
            ? "Your Google access needs renewing before Analytics can load again."
            : ga4Health === "setup"
              ? "This server has no Google OAuth client yet, so the connection cannot start. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment and restart. See the free setup guide for the exact steps."
              : null,
        ]}
        action={
          <ConnectionAction
            projectId={projectId}
            provider="ga4"
            hash="google-analytics"
            health={ga4Health}
            confirming={confirming === "ga4"}
            pending={disconnectGa4Mutation.isPending}
            onAskDisconnect={() => setConfirming("ga4")}
            onCancelDisconnect={() => setConfirming(null)}
            onDisconnect={() => disconnectGa4Mutation.mutate()}
          />
        }
      />

      <ConnectionRow
        title="Bing Webmaster Tools"
        last
        health={
          keysQuery.isPending
            ? "unknown"
            : bingConfigured
              ? "connected"
              : "none"
        }
        lines={[
          "Adds Bing keyword volume next to Google. Optional, and nothing breaks without it.",
          "It is an account-wide API key rather than a per-site connection, so every site here uses the same one.",
        ]}
        action={
          <SecondaryButton
            onClick={() => onOpenProviderKey("bing")}
            style={{ minHeight: 26, padding: "3px 10px", fontSize: 12 }}
          >
            {bingConfigured ? "Manage key" : "Add key"}
          </SecondaryButton>
        }
      />

      <QuietNote
        style={{ margin: 0, padding: "9px 13px", borderTop: ROW_LINE }}
      >
        We do not record a per-connection sync time, so these rows show when the
        connection was made. Reports pull from Google when you open them.
      </QuietNote>
    </div>
  );
}

type Health = "connected" | "reconnect" | "setup" | "none" | "unknown";

function googleHealth(input: {
  connected: boolean;
  hasGrant: boolean;
  oauthConfigured: boolean;
}): Health {
  if (!input.oauthConfigured) return "setup";
  if (!input.connected) return "none";
  return input.hasGrant ? "connected" : "reconnect";
}

const HEALTH_LABEL: Record<Health, string> = {
  connected: "Healthy",
  reconnect: "Needs reconnecting",
  setup: "Setup needed",
  none: "Not connected",
  unknown: "Checking…",
};

const HEALTH_TONE: Record<Health, DotTone> = {
  connected: "success",
  reconnect: "warning",
  setup: "warning",
  none: "muted",
  unknown: "muted",
};

function ConnectionRow({
  title,
  health,
  lines,
  action,
  last,
}: {
  title: string;
  health: Health;
  lines: (string | null)[];
  action: React.ReactNode;
  last?: boolean;
}) {
  const tone = HEALTH_TONE[health];
  const pillToned =
    health === "connected" || health === "reconnect" || health === "setup";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "11px 13px",
        borderBottom: last ? undefined : ROW_LINE,
      }}
    >
      <span style={{ marginTop: 5 }}>
        <StatusDot tone={tone} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
          {pillToned ? (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: `var(--${tone})`,
                background: `var(--${tone}-soft)`,
                border: `1px solid var(--${tone}-border)`,
                borderRadius: 999,
                padding: "1px 7px",
              }}
            >
              {HEALTH_LABEL[health]}
            </span>
          ) : (
            <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
              {HEALTH_LABEL[health]}
            </span>
          )}
        </div>
        {lines
          .filter((line): line is string => Boolean(line))
          .map((line) => (
            <div
              key={line}
              style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}
            >
              {line}
            </div>
          ))}
      </div>
      {action}
    </div>
  );
}

function ConnectionAction({
  projectId,
  provider,
  hash,
  health,
  confirming,
  pending,
  onAskDisconnect,
  onCancelDisconnect,
  onDisconnect,
}: {
  projectId: string;
  provider: "gsc" | "ga4";
  hash: string;
  health: Health;
  confirming: boolean;
  pending: boolean;
  onAskDisconnect: () => void;
  onCancelDisconnect: () => void;
  onDisconnect: () => void;
}) {
  const small = { minHeight: 26, padding: "3px 10px", fontSize: 12 } as const;

  if (health === "setup") return null;

  if (health === "reconnect") {
    return (
      <PrimaryButton
        onClick={() => void startGoogleLink(provider, SETTINGS_PATH)}
        style={small}
      >
        Reconnect
      </PrimaryButton>
    );
  }

  if (health === "connected") {
    // Two taps instead of a confirm() dialog, which this repo bans.
    return confirming ? (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <SecondaryButton
          onClick={onDisconnect}
          disabled={pending}
          style={{ ...small, color: "var(--danger)" }}
        >
          {pending ? "Disconnecting…" : "Confirm"}
        </SecondaryButton>
        <SecondaryButton onClick={onCancelDisconnect} style={small}>
          Cancel
        </SecondaryButton>
      </div>
    ) : (
      <SecondaryButton
        onClick={onAskDisconnect}
        style={{ ...small, color: "var(--text-2)" }}
      >
        Disconnect
      </SecondaryButton>
    );
  }

  // Connecting needs the property picker, which lives on the site's own
  // settings page. Sending people there beats a second copy of that flow.
  return (
    <Link
      to="/p/$projectId/settings"
      params={{ projectId }}
      hash={hash}
      className="prominence-button-secondary"
      style={{ ...small, display: "inline-flex", alignItems: "center" }}
    >
      Connect
    </Link>
  );
}
