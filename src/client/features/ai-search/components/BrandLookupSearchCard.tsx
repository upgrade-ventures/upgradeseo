import { useState, type FormEvent } from "react";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import {
  Field,
  TextInput,
  FieldAlignedAction,
} from "@/client/components/prominence/Field";
import { RunButton } from "@/client/features/ai-search/components/aiControls";
import { BRAND_LOOKUP_MAX_INPUT_LENGTH } from "@/types/schemas/ai-search";

export type LookupField = "query" | "competitors";
export type LookupValidationError = { field: LookupField; message: string };

type Props = {
  query: string;
  onQueryChange: (next: string) => void;
  competitors: string;
  onCompetitorsChange: (next: string) => void;
  onSubmit: (event: FormEvent) => void;
  isLoading: boolean;
  /** Message raised by the last submit attempt. */
  validationError: LookupValidationError | null;
  /**
   * The same rules the submit path applies, so a field can name its own fix on
   * blur instead of waiting for the user to press the button.
   */
  validate: (
    query: string,
    competitors: string,
  ) => LookupValidationError | null;
  /** Clears the active lookup and returns the panel to recent searches. */
  onClear?: () => void;
};

/**
 * The lookup control row. The design assumes a single tracked site and shows no
 * search control at all; this screen points at any brand, so the row is drawn
 * with the design's own field vocabulary rather than invented ones.
 *
 * The Forms & validation page governs it: label always visible and bound with
 * `for`/`id`, description above the control saying why we are asking,
 * placeholders showing the shape of a value rather than naming the field, and
 * the message announced on blur rather than on every keystroke.
 */
export function BrandLookupSearchCard({
  query,
  onQueryChange,
  competitors,
  onCompetitorsChange,
  onSubmit,
  isLoading,
  validationError,
  validate,
  onClear,
}: Props) {
  // A message appears once a field has been left, never while it is being
  // typed into. A failed submit reveals both, since the button spoke for them.
  const [blurred, setBlurred] = useState<Record<LookupField, boolean>>({
    query: false,
    competitors: false,
  });

  const live = validate(query, competitors);
  const messageFor = (field: LookupField): string | null => {
    if (validationError?.field === field) return validationError.message;
    if (!blurred[field]) return null;
    return live?.field === field ? live.message : null;
  };

  const markBlurred = (field: LookupField) =>
    setBlurred((current) => ({ ...current, [field]: true }));

  return (
    <form
      onSubmit={(event) => {
        setBlurred({ query: true, competitors: true });
        onSubmit(event);
      }}
      style={{ padding: "16px var(--pad, 24px)" }}
      aria-busy={isLoading || undefined}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "stretch",
        }}
      >
        <Field
          label="Brand or domain to look up"
          required
          description="The name a customer would use, or the site it belongs to."
          error={messageFor("query")}
          style={{ flex: 1, minWidth: 240, maxWidth: 420 }}
        >
          {(control) => (
            <TextInput
              {...control}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onBlur={() => markBlurred("query")}
              maxLength={BRAND_LOOKUP_MAX_INPUT_LENGTH}
              placeholder="acme.com"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>

        <Field
          label="Competitors"
          description="Optional. Up to five, comma separated. Compared on the Competitor share tab."
          error={messageFor("competitors")}
          style={{ flex: 1, minWidth: 240, maxWidth: 320 }}
        >
          {(control) => (
            <TextInput
              {...control}
              value={competitors}
              onChange={(event) => onCompetitorsChange(event.target.value)}
              onBlur={() => markBlurred("competitors")}
              placeholder="ahrefs.com, semrush.com"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>

        <FieldAlignedAction>
          <RunButton
            running={isLoading}
            idleLabel="Look up"
            runningLabel="Asking our model…"
          />
          {onClear ? (
            <SecondaryButton onClick={onClear}>Recent lookups</SecondaryButton>
          ) : null}
        </FieldAlignedAction>
      </div>
    </form>
  );
}
