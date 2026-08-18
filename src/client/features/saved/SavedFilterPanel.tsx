import { useState, type KeyboardEvent } from "react";

import { Icon } from "@/client/components/icons/IconSprite";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import {
  FIELD,
  FIELD_LABEL,
  ROW_LINE,
  useFocusRing,
} from "@/client/features/saved/savedParts";
import type { SavedKeywordsFilterValues } from "@/client/features/saved-keywords/savedKeywordsFilterTypes";
import type { SavedKeywordsFilterForm } from "@/client/features/saved-keywords/useSavedKeywordsFilters";

/**
 * The refine panel above the table.
 *
 * The design has no filter surface at all, so this is the existing filter set
 * re-expressed in the design's vocabulary: the same terms and the same numeric
 * bounds the server already understands, nothing added.
 */
export function SavedFilterPanel({
  form,
  activeFilterCount,
  onReset,
}: {
  form: SavedKeywordsFilterForm;
  activeFilterCount: number;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        padding: "12px",
        background: "var(--subtle)",
        borderBottom: ROW_LINE,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        <TermsField
          form={form}
          name="include"
          label="Include"
          placeholder="Must contain, e.g. audit"
        />
        <TermsField
          form={form}
          name="exclude"
          label="Exclude"
          placeholder="Must not contain, e.g. jobs"
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        <RangeField
          form={form}
          label="Search volume"
          minName="minVol"
          maxName="maxVol"
          min={0}
        />
        <RangeField
          form={form}
          label="CPC (USD)"
          minName="minCpc"
          maxName="maxCpc"
          step="0.01"
          min={0}
        />
        <RangeField
          form={form}
          label="Difficulty"
          minName="minKd"
          maxName="maxKd"
          min={0}
          max={100}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SecondaryButton
          icon="i-refresh"
          onClick={onReset}
          disabled={activeFilterCount === 0}
        >
          Clear all filters
        </SecondaryButton>
      </div>
    </div>
  );
}

function splitTerms(value: string): string[] {
  return value
    .split(/[,+]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

/** Comma or Enter commits a term; Backspace on an empty draft removes the last. */
function TermsField({
  form,
  name,
  label,
  placeholder,
}: {
  form: SavedKeywordsFilterForm;
  name: "include" | "exclude";
  label: string;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const { focusRing, focusProps } = useFocusRing();

  return (
    <div>
      <span style={FIELD_LABEL} id={`saved-terms-${name}`}>
        {label}
      </span>
      <form.Field name={name}>
        {(field) => {
          const terms = splitTerms(field.state.value);
          const commit = (next: string[]) =>
            field.handleChange([...new Set(next)].join(", "));
          const addDraft = () => {
            const parsed = splitTerms(draft);
            if (parsed.length === 0) return;
            commit([...terms, ...parsed]);
            setDraft("");
          };
          const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addDraft();
            } else if (
              event.key === "Backspace" &&
              draft.length === 0 &&
              terms.length > 0
            ) {
              commit(terms.slice(0, -1));
            }
          };

          return (
            <div
              style={{
                ...FIELD,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 5,
                minHeight: 30,
                boxShadow: focusRing,
              }}
            >
              {terms.map((term) => (
                <span
                  key={term}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    height: 18,
                    padding: "0 6px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    color: "var(--text-2)",
                    background: "var(--inset)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {term}
                  <RemoveTermButton
                    term={term}
                    onRemove={() =>
                      commit(terms.filter((existing) => existing !== term))
                    }
                  />
                </span>
              ))}
              <input
                value={draft}
                aria-labelledby={`saved-terms-${name}`}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  addDraft();
                  focusProps.onBlur();
                }}
                onFocus={focusProps.onFocus}
                placeholder={terms.length === 0 ? placeholder : ""}
                style={{
                  flex: 1,
                  minWidth: 90,
                  border: "none",
                  background: "none",
                  color: "var(--text)",
                  font: "inherit",
                  fontSize: 12,
                  outline: "none",
                }}
              />
            </div>
          );
        }}
      </form.Field>
    </div>
  );
}

function RemoveTermButton({
  term,
  onRemove,
}: {
  term: string;
  onRemove: () => void;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${term}`}
      {...focusProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: 0,
        border: "none",
        background: "none",
        color: "var(--text-3)",
        cursor: "pointer",
        outline: "none",
        borderRadius: 3,
        boxShadow: focusRing,
      }}
    >
      <Icon name="i-x" size={10} />
    </button>
  );
}

type RangeName = keyof SavedKeywordsFilterValues;

function RangeField({
  form,
  label,
  minName,
  maxName,
  step,
  min,
  max,
}: {
  form: SavedKeywordsFilterForm;
  label: string;
  minName: Extract<RangeName, "minVol" | "minCpc" | "minKd">;
  maxName: Extract<RangeName, "maxVol" | "maxCpc" | "maxKd">;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <span style={FIELD_LABEL}>{label}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <NumberField
          form={form}
          name={minName}
          label={`${label} minimum`}
          placeholder="Min"
          step={step}
          min={min}
          max={max}
        />
        <NumberField
          form={form}
          name={maxName}
          label={`${label} maximum`}
          placeholder="Max"
          step={step}
          min={min}
          max={max}
        />
      </div>
    </div>
  );
}

function NumberField({
  form,
  name,
  label,
  placeholder,
  step,
  min,
  max,
}: {
  form: SavedKeywordsFilterForm;
  name: RangeName;
  label: string;
  placeholder: string;
  step?: string;
  min?: number;
  max?: number;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <form.Field name={name}>
      {(field) => (
        <input
          type="number"
          inputMode="decimal"
          aria-label={label}
          placeholder={placeholder}
          step={step}
          min={min}
          max={max}
          value={field.state.value}
          onChange={(event) => field.handleChange(event.target.value)}
          {...focusProps}
          style={{ ...FIELD, width: "100%", minWidth: 0, boxShadow: focusRing }}
        />
      )}
    </form.Field>
  );
}
