import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Icon } from "@/client/components/icons/IconSprite";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { KeyRow } from "@/client/features/settings/ProviderKeyRow";
import {
  EMPTY_DRAFT,
  type Draft,
} from "@/client/features/settings/providerKeyModel";
import {
  Callout,
  LIST_BOX,
  QuietNote,
  ROW_LINE,
  SECTION_LEDE,
  SECTION_TITLE,
  SkeletonBar,
  StatusDot,
  type DotTone,
} from "@/client/features/settings/settingsParts";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getProviderKeys,
  removeProviderKey,
  setProviderKey,
} from "@/serverFunctions/providerKeys";

export function ProviderKeySettings({
  openProvider,
  onOpenProvider,
}: {
  openProvider: string | null;
  onOpenProvider: (provider: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [replacing, setReplacing] = useState<Record<string, boolean>>({});

  const keysQuery = useQuery({
    queryKey: ["providerKeys"],
    queryFn: () => getProviderKeys(),
  });

  const saveMutation = useMutation({
    mutationFn: (input: {
      provider: string;
      secret: string;
      publicIdentifier?: string;
    }) => setProviderKey({ data: input }),
    onSuccess: (statuses, variables) => {
      queryClient.setQueryData(["providerKeys"], statuses);
      // Clear the draft so secrets do not linger in component state.
      setDrafts((current) => ({
        ...current,
        [variables.provider]: EMPTY_DRAFT,
      }));
      setReplacing((current) => ({ ...current, [variables.provider]: false }));
      toast.success("Key saved and encrypted");
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (provider: string) => removeProviderKey({ data: { provider } }),
    onSuccess: (statuses) => {
      queryClient.setQueryData(["providerKeys"], statuses);
      toast.success("Key removed · nothing uses it now");
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const statuses = keysQuery.data ?? [];
  const encryptionUnavailable =
    statuses[0] !== undefined && !statuses[0].encryptionAvailable;
  const counts = {
    connected: statuses.filter((status) => status.configuredByOrganization)
      .length,
    server: statuses.filter(
      (status) =>
        !status.configuredByOrganization && status.configuredByEnvironment,
    ).length,
    unset: statuses.filter(
      (status) =>
        !status.configuredByOrganization && !status.configuredByEnvironment,
    ).length,
  };

  return (
    <section>
      <h2 style={SECTION_TITLE}>Data provider keys</h2>
      <p style={SECTION_LEDE}>
        Bring your own keys so this workspace runs on your accounts and quotas.
        Every provider below is free. Keys are encrypted before they are stored
        and are never shown again after you save them.
      </p>

      {keysQuery.isSuccess ? (
        <div
          style={{
            display: "flex",
            gap: 14,
            margin: "9px 0 10px",
            fontSize: 12,
            color: "var(--text-2)",
            flexWrap: "wrap",
          }}
        >
          <LegendItem tone="success" label={`${counts.connected} connected`} />
          <LegendItem
            tone="warning"
            label={`${counts.server} managed by the server`}
          />
          <LegendItem tone="muted" label={`${counts.unset} not set`} />
        </div>
      ) : (
        <div style={{ height: 10 }} />
      )}

      {encryptionUnavailable ? (
        <Callout tone="warning" style={{ marginBottom: 10 }}>
          <Icon
            name="i-alert"
            size={14}
            style={{ color: "var(--warning)", marginTop: 1 }}
          />
          <div>
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>
              Key storage is not available yet.
            </strong>{" "}
            This server has no secret to encrypt with, so keys cannot be saved.
            Set <code>BETTER_AUTH_SECRET</code> (or{" "}
            <code>SECRETS_ENCRYPTION_KEY</code>) to a long random value and
            restart. Generate one with <code>openssl rand -base64 32</code>.
          </div>
        </Callout>
      ) : null}

      <div style={LIST_BOX}>
        {keysQuery.isPending ? (
          <KeyRowSkeletons />
        ) : keysQuery.isError ? (
          <div style={{ padding: "11px 12px" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
              {getStandardErrorMessage(
                keysQuery.error,
                "We could not load your provider keys.",
              )}
            </p>
            <div style={{ marginTop: 9 }}>
              <SecondaryButton onClick={() => void keysQuery.refetch()}>
                Try again
              </SecondaryButton>
            </div>
          </div>
        ) : (
          statuses.map((status, index) => (
            <KeyRow
              key={status.provider}
              status={status}
              last={index === statuses.length - 1}
              open={openProvider === status.provider}
              onToggle={() =>
                onOpenProvider(
                  openProvider === status.provider ? null : status.provider,
                )
              }
              draft={drafts[status.provider] ?? EMPTY_DRAFT}
              onDraftChange={(patch) =>
                setDrafts((current) => ({
                  ...current,
                  [status.provider]: {
                    ...(current[status.provider] ?? EMPTY_DRAFT),
                    ...patch,
                  },
                }))
              }
              replacing={Boolean(replacing[status.provider])}
              onReplace={(next) =>
                setReplacing((current) => ({
                  ...current,
                  [status.provider]: next,
                }))
              }
              saving={
                saveMutation.isPending &&
                saveMutation.variables?.provider === status.provider
              }
              removing={
                removeMutation.isPending &&
                removeMutation.variables === status.provider
              }
              onSave={(input) => saveMutation.mutate(input)}
              onRemove={() => removeMutation.mutate(status.provider)}
            />
          ))
        )}
      </div>

      <QuietNote>
        We do not meter these keys. Usage and quota live in each provider's own
        console, so there is no request counter to show here.
      </QuietNote>
    </section>
  );
}

function LegendItem({ tone, label }: { tone: DotTone; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <StatusDot tone={tone} size={6} />
      {label}
    </span>
  );
}

function KeyRowSkeletons() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "11px 12px",
            borderBottom: row === 3 ? undefined : ROW_LINE,
          }}
        >
          <SkeletonBar width={7} height={7} />
          <SkeletonBar width={200} height={11} />
          <div style={{ flex: 1 }} />
          <SkeletonBar width={70} height={14} />
        </div>
      ))}
    </div>
  );
}
