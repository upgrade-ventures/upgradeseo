import { useId, type CSSProperties } from "react";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import {
  Chip,
  useFocusRing,
} from "@/client/features/ai-search/components/aiControls";
import type { CitationTab } from "@/client/features/ai-search/brandLookupFilterTypes";
import { formatPlatformLabel } from "@/client/features/ai-search/platformLabels";
import type { BrandLookupFiltersState } from "@/client/features/ai-search/useBrandLookupFilters";

/**
 * The refine panel above the two AI Visibility tables.
 *
 * The design has no filter surface, so this is the existing filter set redrawn
 * in the design's own vocabulary: token colours only, the compact group label
 * the design uses for a column head, and the panel's own `--subtle` fill under
 * the toolbar it opens from.
 *
 * Every control carries a visible label bound with `for`/`id`, per the Forms &
 * validation rule, and placeholders show the shape of a value rather than
 * repeating the field's name.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = { Field: React.ComponentType<any> };

/** The design's compact group label: the table head cell's own treatment. */
const GROUP_LABEL: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: 5,
};

const FIELD: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 30,
  padding: "5px 9px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 12.5,
  outline: "none",
};

function FilterTextInput({
  form,
  name,
  label,
  placeholder,
}: {
  form: AnyForm;
  name: string;
  label: string;
  placeholder: string;
}) {
  const id = useId();
  const { ring, ringProps } = useFocusRing(true);

  return (
    <div>
      <label htmlFor={id} style={GROUP_LABEL}>
        {label}
      </label>
      <form.Field name={name}>
        {(field: {
          state: { value: string };
          handleChange: (v: string) => void;
        }) => (
          <input
            id={id}
            type="text"
            autoComplete="off"
            placeholder={placeholder}
            value={field.state.value}
            onChange={(event) => field.handleChange(event.target.value)}
            {...ringProps}
            style={{ ...FIELD, ...ring }}
          />
        )}
      </form.Field>
    </div>
  );
}

function CompactRangeInput({
  form,
  name,
  label,
  placeholder,
}: {
  form: AnyForm;
  name: string;
  /** Not shown: the visible label belongs to the pair, this names the bound. */
  label: string;
  placeholder: string;
}) {
  const { ring, ringProps } = useFocusRing(true);
  return (
    <form.Field name={name}>
      {(field: {
        state: { value: string };
        handleChange: (v: string) => void;
      }) => (
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          placeholder={placeholder}
          value={field.state.value}
          onChange={(event) => field.handleChange(event.target.value)}
          {...ringProps}
          style={{
            ...FIELD,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.01em",
            ...ring,
          }}
        />
      )}
    </form.Field>
  );
}

function FilterRangeInputs({
  form,
  title,
  minName,
  maxName,
}: {
  form: AnyForm;
  title: string;
  minName: string;
  maxName: string;
}) {
  return (
    <div>
      {/* The pair is one labelled group; each bound names itself for a reader. */}
      <span style={GROUP_LABEL}>{title}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <CompactRangeInput
          form={form}
          name={minName}
          label={`${title} minimum`}
          placeholder="Min"
        />
        <CompactRangeInput
          form={form}
          name={maxName}
          label={`${title} maximum`}
          placeholder="Max"
        />
      </div>
    </div>
  );
}

const PLATFORM_VALUES = ["", "chat_gpt", "google"] as const;

function PlatformToggle({ form }: { form: AnyForm }) {
  const groupId = useId();
  return (
    <div>
      <span id={groupId} style={GROUP_LABEL}>
        Model
      </span>
      <form.Field name="platform">
        {(field: {
          state: { value: string };
          handleChange: (v: string) => void;
        }) => (
          <div
            role="group"
            aria-labelledby={groupId}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
            }}
          >
            {PLATFORM_VALUES.map((value) => (
              <Chip
                key={value || "all"}
                active={field.state.value === value}
                onClick={() => field.handleChange(value)}
              >
                {value === "" ? "All" : formatPlatformLabel(value)}
              </Chip>
            ))}
          </div>
        )}
      </form.Field>
    </div>
  );
}

function TabFilters({
  form,
  rangeTitle,
  minName,
  maxName,
  includePlaceholder,
  excludePlaceholder,
}: {
  form: AnyForm;
  rangeTitle: string;
  minName: string;
  maxName: string;
  includePlaceholder: string;
  excludePlaceholder: string;
}) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <FilterTextInput
          form={form}
          name="include"
          label="Include terms"
          placeholder={includePlaceholder}
        />
        <FilterTextInput
          form={form}
          name="exclude"
          label="Exclude terms"
          placeholder={excludePlaceholder}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <PlatformToggle form={form} />
        <FilterRangeInputs
          form={form}
          title={rangeTitle}
          minName={minName}
          maxName={maxName}
        />
      </div>
    </>
  );
}

export function BrandLookupFilterPanel({
  activeTab,
  filters,
}: {
  activeTab: CitationTab;
  filters: BrandLookupFiltersState;
}) {
  const current = filters[activeTab];

  return (
    // Gutters match the table below it, so the panel opens in line with the
    // page rather than inside an invisible card.
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: "10px var(--pad, 24px)",
        borderBottom: "1px solid var(--line)",
        background: "var(--subtle)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Refine results</span>
          {current.activeFilterCount > 0 ? (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--accent)",
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                borderRadius: 999,
                padding: "0 7px",
              }}
            >
              {current.activeFilterCount} active
            </span>
          ) : null}
        </div>
        <SecondaryButton
          icon="i-refresh"
          onClick={current.reset}
          disabled={current.activeFilterCount === 0}
        >
          Clear all
        </SecondaryButton>
      </div>

      {activeTab === "pages" ? (
        <TabFilters
          form={filters.pages.form}
          rangeTitle="Source mentions"
          minName="minMentions"
          maxName="maxMentions"
          includePlaceholder="reddit, forbes"
          excludePlaceholder="pinterest, /tag"
        />
      ) : (
        <TabFilters
          form={filters.queries.form}
          rangeTitle="AI search volume"
          minName="minVolume"
          maxName="maxVolume"
          includePlaceholder="pricing, reviews"
          excludePlaceholder="login, download"
        />
      )}
    </div>
  );
}
