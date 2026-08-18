import {
  Field,
  TextInput,
  useBlurValidation,
} from "@/client/components/prominence/Field";
import { PrimaryButton } from "@/client/components/prominence/Primitives";
import type {
  Draft,
  ProviderStatus,
} from "@/client/features/settings/providerKeyModel";

export function KeyForm({
  status,
  secretInputs,
  draft,
  filled,
  saving,
  onDraftChange,
  onSubmit,
}: {
  status: ProviderStatus;
  secretInputs: readonly { name: string; label: string }[];
  draft: Draft;
  filled: boolean;
  saving: boolean;
  onDraftChange: (patch: Partial<Draft>) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      style={{ maxWidth: 380, marginTop: 10 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!filled || saving || !status.encryptionAvailable) return;
        onSubmit();
      }}
    >
      {status.publicFieldLabel ? (
        <KeyField
          label={status.publicFieldLabel}
          value={draft.publicIdentifier}
          placeholder={status.publicIdentifier ?? ""}
          onChange={(value) => onDraftChange({ publicIdentifier: value })}
        />
      ) : null}

      {secretInputs.map((field) => (
        <KeyField
          key={field.name || "secret"}
          label={field.label}
          secret
          value={draft.parts[field.name] ?? ""}
          placeholder="Paste your key"
          onChange={(value) =>
            onDraftChange({ parts: { ...draft.parts, [field.name]: value } })
          }
        />
      ))}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 9,
          flexWrap: "wrap",
        }}
      >
        <PrimaryButton
          type="submit"
          disabled={saving || !filled || !status.encryptionAvailable}
        >
          {saving ? "Saving…" : "Save key"}
        </PrimaryButton>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>
          Encrypted before it is stored. We do not call the provider to check it
          first.
        </span>
      </div>
    </form>
  );
}

function KeyField({
  label,
  value,
  placeholder,
  secret,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  secret?: boolean;
  onChange: (value: string) => void;
}) {
  // Every part of a provider key is required: a half-entered key would be
  // stored, encrypted, and then fail on the first call instead of here.
  const field = useBlurValidation(value, (current) =>
    current.trim()
      ? null
      : `Paste the ${label.toLowerCase()} from your provider account.`,
  );

  return (
    <Field
      label={label}
      required
      description={secret ? "Never shown again once you save it." : undefined}
      error={field.error}
      style={{ marginBottom: 8 }}
    >
      {(props) => (
        <TextInput
          {...props}
          // type=password so values are not shoulder-readable.
          type={secret ? "password" : "text"}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          // Read the value BEFORE the updater runs: `currentTarget` is null for
          // programmatically dispatched events (password managers, autofill).
          onChange={(event) => onChange(event.target.value)}
          {...field.fieldProps}
        />
      )}
    </Field>
  );
}
