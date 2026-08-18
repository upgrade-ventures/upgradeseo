import { useState } from "react";

import { Icon } from "@/client/components/icons/IconSprite";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { KeyForm } from "@/client/features/settings/ProviderKeyForm";
import {
  PROVIDER_HELP,
  providerRowId,
  type Draft,
  type ProviderStatus,
} from "@/client/features/settings/providerKeyModel";
import {
  Callout,
  DangerButton,
  formatDay,
  META_GRID,
  META_LABEL,
  ROW_LINE,
  StatusDot,
  useFocusRing,
  type DotTone,
} from "@/client/features/settings/settingsParts";

export function KeyRow({
  status,
  last,
  open,
  onToggle,
  draft,
  onDraftChange,
  replacing,
  onReplace,
  saving,
  removing,
  onSave,
  onRemove,
}: {
  status: ProviderStatus;
  last: boolean;
  open: boolean;
  onToggle: () => void;
  draft: Draft;
  onDraftChange: (patch: Partial<Draft>) => void;
  replacing: boolean;
  onReplace: (next: boolean) => void;
  saving: boolean;
  removing: boolean;
  onSave: (input: {
    provider: string;
    secret: string;
    publicIdentifier?: string;
  }) => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { focusRing, focusProps } = useFocusRing();
  const help = PROVIDER_HELP[status.provider];

  const stored = status.configuredByOrganization;
  const fromServer = !stored && status.configuredByEnvironment;
  const tone: DotTone = stored ? "success" : fromServer ? "warning" : "muted";

  // Driven by the provider registry, never a hardcoded id. A hardcoded
  // `=== "google_oauth"` check previously meant Google Ads and Foundery could
  // never render their extra fields at all.
  const secretInputs =
    status.secretFields.length > 0
      ? status.secretFields
      : [{ name: "", label: "Key" }];
  const filled = secretInputs.every((field) =>
    (draft.parts[field.name] ?? "").trim(),
  );
  const showForm = !stored || replacing;

  return (
    <div style={{ borderBottom: last ? undefined : ROW_LINE }}>
      <button
        type="button"
        id={providerRowId(status.provider)}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${providerRowId(status.provider)}-panel`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        {...focusProps}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "11px 12px",
          border: "none",
          background: hovered ? "var(--subtle)" : "none",
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
          outline: "none",
          boxShadow: focusRing,
        }}
      >
        <StatusDot tone={tone} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          {status.label}
        </span>
        {saving ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              color: "var(--info)",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                border: "2px solid var(--info)",
                borderTopColor: "transparent",
                animation: "spin 1s linear infinite",
              }}
            />
            Saving…
          </span>
        ) : stored ? (
          <KeyPill tone="success">Your key</KeyPill>
        ) : fromServer ? (
          <KeyPill tone="warning">Managed by the server</KeyPill>
        ) : (
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-3)",
              whiteSpace: "nowrap",
            }}
          >
            Not set
          </span>
        )}
        <Icon name="i-chev-down" size={13} style={{ color: "var(--text-3)" }} />
      </button>

      {open ? (
        <div
          id={`${providerRowId(status.provider)}-panel`}
          style={{ padding: "0 12px 12px" }}
        >
          {help?.unread ? (
            <Callout tone="warning" style={{ marginBottom: 10 }}>
              <Icon
                name="i-alert"
                size={14}
                style={{ color: "var(--warning)", marginTop: 1 }}
              />
              <div>
                <strong style={{ color: "var(--text)", fontWeight: 600 }}>
                  Nothing reads this key yet.
                </strong>{" "}
                {help.unread}
              </div>
            </Callout>
          ) : null}

          {help ? (
            <p
              style={{
                margin: "0 0 9px",
                fontSize: 12,
                color: "var(--text-2)",
              }}
            >
              {help.blurb}
            </p>
          ) : null}

          {stored ? (
            <div style={META_GRID}>
              <div>
                <div style={META_LABEL}>Key</div>
                <div style={{ fontSize: 13 }}>
                  {status.secretLastFour
                    ? `••••••••••••${status.secretLastFour}`
                    : "Stored · not readable here"}
                </div>
              </div>
              {status.publicFieldLabel ? (
                <div>
                  <div style={META_LABEL}>{status.publicFieldLabel}</div>
                  <div style={{ fontSize: 13 }}>
                    {status.publicIdentifier || "Not set"}
                  </div>
                </div>
              ) : null}
              <div>
                <div style={META_LABEL}>Saved</div>
                <div style={{ fontSize: 13 }}>
                  {formatDay(status.updatedAt) ?? "Unknown"}
                </div>
              </div>
            </div>
          ) : fromServer ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)" }}>
              This server supplies a key from its own environment, so the
              feature works on the operator's quota. Save your own below to stop
              sharing it.
            </p>
          ) : null}

          {showForm ? (
            <KeyForm
              status={status}
              secretInputs={secretInputs}
              draft={draft}
              filled={filled}
              saving={saving}
              onDraftChange={onDraftChange}
              onSubmit={() => {
                // Multi-field providers travel as one JSON string inside the
                // single encrypted column.
                const secret =
                  status.secretFields.length > 0
                    ? JSON.stringify(
                        Object.fromEntries(
                          secretInputs.map((field) => [
                            field.name,
                            (draft.parts[field.name] ?? "").trim(),
                          ]),
                        ),
                      )
                    : (draft.parts[""] ?? "").trim();
                onSave({
                  provider: status.provider,
                  secret,
                  publicIdentifier: status.publicFieldLabel
                    ? draft.publicIdentifier.trim()
                    : undefined,
                });
              }}
            />
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {stored && !replacing ? (
              <SecondaryButton onClick={() => onReplace(true)}>
                Replace key
              </SecondaryButton>
            ) : null}
            {stored && replacing ? (
              <SecondaryButton onClick={() => onReplace(false)}>
                Cancel
              </SecondaryButton>
            ) : null}
            {stored ? (
              <DangerButton onClick={onRemove} disabled={removing}>
                {removing ? "Removing…" : "Remove"}
              </DangerButton>
            ) : null}
            {help ? (
              <a
                href={help.href}
                target="_blank"
                rel="noreferrer noopener"
                style={{ alignSelf: "center", fontSize: 12 }}
              >
                {/* Some labels are themselves a path with arrows in them, so
                    the trailing arrow is only added when one is missing. */}
                {help.hrefLabel.includes("→")
                  ? help.hrefLabel
                  : `${help.hrefLabel} →`}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KeyPill({
  tone,
  children,
}: {
  tone: "success" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: `var(--${tone})`,
        background: `var(--${tone}-soft)`,
        border: `1px solid var(--${tone}-border)`,
        borderRadius: 999,
        padding: "1px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
