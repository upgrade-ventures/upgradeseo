import type { FormEvent } from "react";
import {
  Chip,
  ControlSelect,
  RunButton,
  useFocusRing,
} from "@/client/features/ai-search/components/aiControls";
import {
  Field,
  TextInput,
  FieldAlignedAction,
} from "@/client/components/prominence/Field";
import {
  formatCountryLabel,
  formatModelLabel,
} from "@/client/features/ai-search/platformLabels";
import {
  PROMPT_EXPLORER_MAX_PROMPT_LENGTH,
  PROMPT_EXPLORER_MODELS,
  WEB_SEARCH_COUNTRY_CODES,
  type PromptExplorerModel,
  type WebSearchCountryCode,
} from "@/types/schemas/ai-search";

type FormValues = {
  prompt: string;
  highlightBrand: string;
  models: PromptExplorerModel[];
  webSearch: boolean;
  webSearchCountryCode: WebSearchCountryCode;
};

export type PromptExplorerErrors = {
  prompt?: string;
  models?: string;
};

type Props = {
  form: FormValues;
  onPromptChange: (value: string) => void;
  onHighlightBrandChange: (value: string) => void;
  onModelsChange: (value: PromptExplorerModel[]) => void;
  onWebSearchChange: (value: boolean) => void;
  onCountryChange: (value: WebSearchCountryCode) => void;
  onSubmit: (event: FormEvent) => void;
  isLoading: boolean;
  errors: PromptExplorerErrors;
};

function isCountryCode(value: string): value is WebSearchCountryCode {
  return (WEB_SEARCH_COUNTRY_CODES as readonly string[]).includes(value);
}

function parseCountryCode(value: string): WebSearchCountryCode {
  return isCountryCode(value) ? value : "US";
}

/**
 * The design's control row: prompt, one select, one run button. The extra
 * controls this screen actually sends (the brand to look for, the requested
 * models, the web-search location) sit on a second line in the same
 * vocabulary, since dropping them would drop what the request can express.
 *
 * The design's own row labels its inputs with `aria-label` only. The Forms &
 * validation page overrides that for the whole product — "Label always
 * visible. Placeholders show format, never the name of the field." — so the
 * two text fields carry real labels here, and the placeholders are left to
 * show shape.
 */
export function PromptExplorerForm({
  form,
  onPromptChange,
  onHighlightBrandChange,
  onModelsChange,
  onWebSearchChange,
  onCountryChange,
  onSubmit,
  isLoading,
  errors,
}: Props) {
  const promptOverLimit =
    form.prompt.length > PROMPT_EXPLORER_MAX_PROMPT_LENGTH;

  const toggleModel = (model: PromptExplorerModel) => {
    onModelsChange(
      form.models.includes(model)
        ? form.models.filter((current) => current !== model)
        : [...form.models, model],
    );
  };

  return (
    <form onSubmit={onSubmit} aria-busy={isLoading || undefined}>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "stretch",
          marginBottom: 10,
        }}
      >
        <Field
          label="Prompt to test"
          required
          description="Ask what a customer would ask an assistant, in their words."
          error={errors.prompt ?? null}
          counter={`${form.prompt.length} / ${PROMPT_EXPLORER_MAX_PROMPT_LENGTH}`}
          style={{ flex: 1, minWidth: 260, maxWidth: 460 }}
        >
          {(control) => (
            <TextInput
              {...control}
              value={form.prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              maxLength={PROMPT_EXPLORER_MAX_PROMPT_LENGTH + 50}
              placeholder="best seo tool for a small team"
              aria-invalid={
                promptOverLimit || errors.prompt
                  ? true
                  : control["aria-invalid"]
              }
              autoComplete="off"
              autoFocus
            />
          )}
        </Field>

        <Field
          label="Brand to look for"
          description="Optional. We mark it wherever the answer names it."
          style={{ width: 220, minWidth: 180 }}
        >
          {(control) => (
            <TextInput
              {...control}
              value={form.highlightBrand}
              onChange={(event) => onHighlightBrandChange(event.target.value)}
              placeholder="Prominence"
              autoComplete="off"
            />
          )}
        </Field>

        {/* Aligns with the control line of the two fields above, which sit
            under a label and a description. */}
        <FieldAlignedAction>
          <RunButton
            running={isLoading}
            idleLabel="Run prompt"
            runningLabel={`Running ${form.models.length} model${form.models.length === 1 ? "" : "s"}…`}
            disabled={form.models.length === 0}
          />
        </FieldAlignedAction>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          id="prompt-explorer-models"
          style={{ fontSize: 12.5, fontWeight: 600 }}
        >
          Models
        </span>
        <div
          role="group"
          aria-labelledby="prompt-explorer-models"
          aria-describedby="prompt-explorer-models-error"
          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
        >
          {PROMPT_EXPLORER_MODELS.map((model) => (
            <Chip
              key={model}
              active={form.models.includes(model)}
              onClick={() => toggleModel(model)}
            >
              {formatModelLabel(model)}
            </Chip>
          ))}
        </div>

        <WebSearchToggle
          checked={form.webSearch}
          onChange={onWebSearchChange}
        />
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Label always visible, per the Forms & validation rule. It greys
              with the select it names when web search is off. */}
          <label
            htmlFor="prompt-explorer-location"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: form.webSearch ? undefined : "var(--text-3)",
            }}
          >
            Searching from
          </label>
          <ControlSelect
            id="prompt-explorer-location"
            value={form.webSearchCountryCode}
            disabled={!form.webSearch}
            onChange={(event) =>
              onCountryChange(parseCountryCode(event.target.value))
            }
          >
            {WEB_SEARCH_COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>
                {formatCountryLabel(code)}
              </option>
            ))}
          </ControlSelect>
        </span>
      </div>

      {/* Always mounted, so the message is an update to a live region. */}
      <div id="prompt-explorer-models-error" aria-live="polite">
        {errors.models ? (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: "var(--danger)",
            }}
          >
            {errors.models}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function WebSearchToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const { ring, ringProps } = useFocusRing();
  return (
    <label
      // A 14px box is well under the 44px touch floor, and the label is the
      // whole hit area. A media query cannot be written inline.
      className="max-sm:min-h-11"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        color: "var(--text-2)",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        {...ringProps}
        style={{
          width: 14,
          height: 14,
          accentColor: "var(--accent)",
          cursor: "pointer",
          borderRadius: 3,
          ...ring,
        }}
      />
      Allow web search
    </label>
  );
}
