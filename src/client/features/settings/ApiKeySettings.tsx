import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  Field,
  TextInput,
  useBlurValidation,
} from "@/client/components/prominence/Field";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import {
  DangerButton,
  formatDay,
  LIST_BOX,
  QuietNote,
  ROW_LINE,
  SECTION_LEDE,
  SECTION_TITLE,
  SkeletonBar,
} from "@/client/features/settings/settingsParts";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { captureClientEvent } from "@/client/lib/posthog";
import { authClient } from "@/lib/auth-client";

// Better Auth rejects longer names with INVALID_NAME_LENGTH.
const MAX_KEY_NAME_LENGTH = 32;

/**
 * There is no monospace font in this design. `<code>` would otherwise pick up
 * the browser's monospace stack through Tailwind's preflight, so the family is
 * pinned back to the UI one wherever a literal is shown.
 */
const INLINE_CODE = { fontFamily: "inherit" } as const;

export function ApiKeySettings() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const nameField = useBlurValidation(name, (value) =>
    value.trim()
      ? null
      : "Give the key a name, such as the machine it lives on.",
  );

  const mcpUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/mcp`;

  const apiKeysQuery = useQuery({
    queryKey: ["apiKeys"],
    queryFn: async () => {
      const result = await authClient.apiKey.list();
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to load API keys");
      }
      return result.data.apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        start: key.start,
        createdAt: new Date(key.createdAt).toISOString(),
        lastRequest: key.lastRequest
          ? new Date(key.lastRequest).toISOString()
          : null,
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (keyName: string) => {
      const result = await authClient.apiKey.create({ name: keyName });
      if (result.error || !result.data?.key) {
        throw new Error(result.error?.message ?? "Failed to create the key");
      }
      return result.data.key;
    },
    onSuccess: (key) => {
      setCreatedKey(key);
      setName("");
      captureClientEvent("mcp:api_key_created");
      void queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const result = await authClient.apiKey.delete({ keyId });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to revoke the key");
      }
    },
    onSuccess: () => {
      setRevoking(null);
      captureClientEvent("mcp:api_key_revoked");
      toast.success("API key revoked");
      void queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const apiKeys = apiKeysQuery.data ?? [];

  const closeCreate = () => {
    setIsCreating(false);
    setCreatedKey(null);
    setName("");
  };

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={SECTION_TITLE}>API keys</h2>
          <p style={SECTION_LEDE}>
            Authenticate MCP clients where the browser login does not work, such
            as a remote agent or a CI job. The setup guides live on{" "}
            <Link to="/ai">AI &amp; MCP</Link>.
          </p>
        </div>
        {isCreating ? null : (
          <PrimaryButton icon="i-plus" onClick={() => setIsCreating(true)}>
            Create API key
          </PrimaryButton>
        )}
      </div>

      {isCreating ? (
        <div
          style={{
            ...LIST_BOX,
            marginTop: 10,
            padding: 12,
            background: "var(--subtle)",
          }}
        >
          {createdKey ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Copy your new API key
              </div>
              <p
                style={{
                  margin: "5px 0 9px",
                  fontSize: 12.5,
                  color: "var(--text-2)",
                }}
              >
                It is not shown again. Send it as an{" "}
                <code style={INLINE_CODE}>Authorization: Bearer</code> header to{" "}
                <code style={INLINE_CODE}>{mcpUrl}</code>.
              </p>
              <code
                style={{
                  ...INLINE_CODE,
                  display: "block",
                  overflowX: "auto",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  fontSize: 12,
                }}
              >
                {createdKey}
              </code>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <SecondaryButton
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(createdKey)
                      .then(() => toast.success("API key copied"))
                      .catch(() =>
                        toast.error("Your browser blocked the clipboard."),
                      );
                  }}
                >
                  Copy key
                </SecondaryButton>
                <SecondaryButton onClick={closeCreate}>Done</SecondaryButton>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                // Reveal the message rather than sitting behind a disabled
                // button: a control that will not respond and will not say why
                // is the failure the Forms page exists to prevent.
                if (!nameField.isValid) {
                  nameField.reveal();
                  return;
                }
                createMutation.mutate(name.trim());
              }}
            >
              <Field
                label="Name"
                required
                description="Name it after the machine or agent that will carry it, so you know what you are revoking later."
                error={nameField.error}
                counter={`${name.length} / ${MAX_KEY_NAME_LENGTH}`}
                style={{ maxWidth: 280 }}
              >
                {(props) => (
                  <TextInput
                    {...props}
                    value={name}
                    maxLength={MAX_KEY_NAME_LENGTH}
                    placeholder="Claude Code on laptop"
                    onChange={(event) => setName(event.target.value)}
                    {...nameField.fieldProps}
                  />
                )}
              </Field>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <PrimaryButton
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating…" : "Create"}
                </PrimaryButton>
                <SecondaryButton onClick={closeCreate}>Cancel</SecondaryButton>
              </div>
            </form>
          )}
        </div>
      ) : null}

      <div style={{ ...LIST_BOX, marginTop: 10 }}>
        {apiKeysQuery.isPending ? (
          <div aria-hidden style={{ padding: "9px 12px" }}>
            <SkeletonBar width="60%" height={11} />
          </div>
        ) : apiKeysQuery.isError ? (
          <p
            style={{
              margin: 0,
              padding: "11px 12px",
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            {getStandardErrorMessage(
              apiKeysQuery.error,
              "We could not load your API keys.",
            )}
          </p>
        ) : apiKeys.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "11px 12px",
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            No API keys yet. MCP clients that can sign in with OAuth do not need
            one.
          </p>
        ) : (
          apiKeys.map((key, index) => (
            <div
              key={key.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderBottom:
                  index === apiKeys.length - 1 ? undefined : ROW_LINE,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {key.name || "Unnamed key"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {key.start || "oseo_"}… · created {formatDay(key.createdAt)} ·{" "}
                  {key.lastRequest
                    ? `last used ${formatDay(key.lastRequest)}`
                    : "never used"}
                </div>
              </div>
              {revoking === key.id ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <DangerButton
                    solid
                    disabled={revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(key.id)}
                  >
                    {revokeMutation.isPending ? "Revoking…" : "Confirm revoke"}
                  </DangerButton>
                  <SecondaryButton onClick={() => setRevoking(null)}>
                    Cancel
                  </SecondaryButton>
                </div>
              ) : (
                <SecondaryButton
                  onClick={() => setRevoking(key.id)}
                  style={{ minHeight: 24, padding: "2px 9px", fontSize: 12 }}
                >
                  Revoke
                </SecondaryButton>
              )}
            </div>
          ))
        )}
      </div>

      {revoking ? (
        <QuietNote>Clients using that key stop working immediately.</QuietNote>
      ) : null}
    </section>
  );
}
