import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Icon } from "@/client/components/icons/IconSprite";
import { PrimaryButton } from "@/client/components/prominence/Primitives";
import { SelfHostedSetupWarning } from "@/client/features/gsc/SelfHostedSetupWarning";
import {
  SitePicker,
  type GscSiteSelection,
} from "@/client/features/gsc/SitePicker";
import { startGoogleLink } from "@/client/features/integrations/startGoogleLink";
import {
  ErrorLine,
  Skeleton,
  WorkingPanel,
} from "@/client/features/onboarding/onboardingControls";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { captureClientEvent } from "@/client/lib/posthog";
import {
  getGscConnection,
  listGscSites,
  setGscSite,
} from "@/serverFunctions/gsc";

const GRANT_STATUS_KEY = ["gscGrantStatus"];

/**
 * The controls behind the checklist's Search Console step: link the
 * account-level OAuth grant, then bind a verified property to the project,
 * the same binding the project's Integrations page does, so it's done in one
 * place.
 *
 * The step's done presentation belongs to the checklist, which reads the same
 * `gscConnection` query; this component only covers the work still to do.
 */
export function SearchConsoleOnboardingStep({
  projectId,
  skipAction,
}: {
  projectId: string;
  /**
   * The checklist's "Skip for now" control. Rendered here rather than beside
   * this component so it can share the design's button row with Connect, and
   * fall below the panel in the states that have no button of their own.
   */
  skipAction?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [selection, setSelection] = React.useState<GscSiteSelection | null>(
    null,
  );
  // startGoogleLink navigates the whole page to Google, so this only survives
  // long enough to cover the round trip to our own server for the link URL.
  const [connecting, setConnecting] = React.useState(false);

  const connectionKey = ["gscConnection", projectId];
  const connectionQuery = useQuery({
    queryKey: connectionKey,
    queryFn: () => getGscConnection({ data: { projectId } }),
  });
  const connection = connectionQuery.data;
  const connected = Boolean(connection?.connected);
  const hasGrant = Boolean(connection?.currentUserHasGrant);
  const needsSetup =
    connectionQuery.isSuccess && !connection?.googleOAuthConfigured;

  const sitesQuery = useQuery({
    queryKey: ["gscSites", projectId],
    queryFn: () => listGscSites({ data: { projectId } }),
    enabled: hasGrant && !connected && !needsSetup,
  });
  const accounts = React.useMemo(
    () => sitesQuery.data?.accounts ?? [],
    [sitesQuery.data?.accounts],
  );
  const requiresReconnect = accounts.some(
    (account) => account.requiresReconnect,
  );

  React.useEffect(() => {
    if (!requiresReconnect) return;

    void queryClient.invalidateQueries({
      queryKey: ["gscConnection", projectId],
    });
    void queryClient.invalidateQueries({ queryKey: GRANT_STATUS_KEY });
  }, [requiresReconnect, queryClient, projectId]);

  const setSiteMutation = useMutation({
    mutationFn: (selected: GscSiteSelection) =>
      setGscSite({ data: { projectId, ...selected } }),
    onSuccess: () => {
      captureClientEvent("gsc:property_select");
      void queryClient.invalidateQueries({ queryKey: connectionKey });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const handleConnect = () => {
    captureClientEvent("onboarding:gsc_connect_clicked");
    setConnecting(true);
    // Resolves only when the redirect never happens (a failed link start),
    // which is exactly when the panel has to go back to the button.
    void startGoogleLink("gsc", window.location.href).finally(() =>
      setConnecting(false),
    );
  };

  // Every branch below the connect button keeps the skip control reachable, so
  // a broken or unconfigurable connection is never a dead end.
  const skipRow = skipAction ? (
    <div style={{ marginTop: 9 }}>{skipAction}</div>
  ) : null;

  if (connectionQuery.isLoading) {
    return (
      <div style={{ display: "grid", gap: 6, maxWidth: 340 }}>
        <Skeleton width={200} />
        <Skeleton width={130} />
      </div>
    );
  }

  if (connectionQuery.isError) {
    return (
      <div>
        <ErrorLine onRetry={() => void connectionQuery.refetch()}>
          Could not check your Google connection.
        </ErrorLine>
        {skipRow}
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div>
        <SelfHostedSetupWarning />
        {skipRow}
      </div>
    );
  }

  if (connected) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12.5,
          color: "var(--success)",
        }}
      >
        <Icon name="i-check" size={13} style={{ strokeWidth: 2 }} />
        <span>Connected to {connection?.siteUrl}.</span>
      </div>
    );
  }

  if (hasGrant) {
    return (
      <div>
        <SitePicker
          loading={sitesQuery.isLoading}
          error={sitesQuery.isError}
          accounts={accounts}
          selection={selection}
          onSelect={setSelection}
          onSave={() => selection && setSiteMutation.mutate(selection)}
          saving={setSiteMutation.isPending}
          onRetry={() => void sitesQuery.refetch()}
          onReconnect={handleConnect}
        />
        <p
          style={{ margin: "9px 0 0", fontSize: 11.5, color: "var(--text-3)" }}
        >
          Pick the property that matches this site. Only properties your Google
          account is verified on can be selected.
        </p>
        {skipRow}
      </div>
    );
  }

  if (connecting) {
    return (
      <WorkingPanel title="Waiting for Google">
        Opening Google&rsquo;s consent screen. You land back here once you
        finish it.
      </WorkingPanel>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <PrimaryButton onClick={handleConnect}>
          Connect Search Console
        </PrimaryButton>
        {skipAction}
      </div>
      <p style={{ margin: "7px 0 0", fontSize: 11.5, color: "var(--text-3)" }}>
        Opens Google&rsquo;s consent screen. We ask for read-only access and
        never post anything.
      </p>
      <p style={{ margin: "5px 0 0", fontSize: 11.5, color: "var(--text-3)" }}>
        For now, Search Console data flows through the UpgradeSEO MCP. We are
        building it into the app too.
      </p>
    </div>
  );
}
