import {
  KEYWORD_INTENT_ORDER,
  parseIntentFilter,
  toggleIntentFilter,
} from "@/client/features/keywords/keywordResearchTypes";
import { INTENT_LABELS } from "@/client/features/keywords/components/IntentBadge";
import { Chip, GhostButton, useFocusRing } from "./prominenceControls";
import type { KeywordResearchControllerState } from "./types";

/**
 * The filter builder the design's "+ Filter" chip only promises in a toast.
 * It writes the same local filter values the chips and saved views do, so the
 * bar above always reflects whatever is typed here.
 */

type FiltersForm = KeywordResearchControllerState["filtersForm"];
type RangeName = "minVol" | "maxVol" | "minCpc" | "maxCpc" | "minKd" | "maxKd";

const GROUP_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

/** Description sits under the control here because the grid rows must line up. */
const HELP_TEXT: React.CSSProperties = {
  fontSize: 11.5,
  color: "var(--text-3)",
};

export function KeywordResearchFilterPanel({
  controller,
}: {
  controller: KeywordResearchControllerState;
}) {
  const { activeFilterCount, filtersForm, rows } = controller;
  const hasDifficulty = rows.some((row) => row.keywordDifficulty !== null);
  const hasIntent = rows.some((row) => row.intent !== "unknown");

  return (
    <div
      id="keyword-filter-panel"
      style={{
        padding: "10px var(--pad, 24px) 12px",
        background: "var(--subtle)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span style={GROUP_LABEL}>Refine table results</span>
        <GhostButton
          disabled={activeFilterCount === 0}
          onClick={controller.resetFilters}
          style={{
            opacity: activeFilterCount === 0 ? 0.55 : 1,
            cursor: activeFilterCount === 0 ? "not-allowed" : "pointer",
          }}
        >
          Clear all
        </GhostButton>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 10,
        }}
      >
        <TextFilter
          form={filtersForm}
          name="include"
          label="Include terms"
          placeholder="audit, checker, template"
          help="Comma separated. A keyword has to contain every term."
        />
        <TextFilter
          form={filtersForm}
          name="exclude"
          label="Exclude terms"
          placeholder="jobs, salary, course"
          help="Comma separated. Any one match drops the keyword."
        />
        <RangeFilter
          form={filtersForm}
          label="Search volume"
          minName="minVol"
          maxName="maxVol"
        />
        <RangeFilter
          form={filtersForm}
          label="CPC"
          minName="minCpc"
          maxName="maxCpc"
          step="0.01"
        />
        <RangeFilter
          form={filtersForm}
          label="Difficulty"
          minName="minKd"
          maxName="maxKd"
          disabledReason={
            hasDifficulty
              ? undefined
              : "Keyword difficulty is not available from the data sources connected to this project."
          }
        />
        <IntentFilter
          form={filtersForm}
          disabledReason={
            hasIntent
              ? undefined
              : "Search intent is not available from the data sources connected to this project."
          }
        />
      </div>
    </div>
  );
}

function FilterInput({
  id,
  value,
  onChange,
  placeholder,
  type,
  step,
  disabled,
  ariaLabel,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "number";
  step?: string;
  disabled?: boolean;
  /** Only for the min/max pair, where the visible label covers both inputs. */
  ariaLabel?: string;
  describedBy?: string;
}) {
  const { ring, ringProps } = useFocusRing();

  return (
    <input
      id={id}
      type={type}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      {...ringProps}
      style={{
        minWidth: 0,
        minHeight: "max(28px, var(--tap, 0px))",
        padding: "4px 8px",
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--surface)",
        color: "var(--text)",
        fontFamily: "inherit",
        fontSize: 12.5,
        ...(disabled ? { opacity: 0.55, cursor: "not-allowed" } : null),
        ...ring,
      }}
    />
  );
}

function TextFilter({
  form,
  name,
  label,
  placeholder,
  help,
}: {
  form: FiltersForm;
  name: "include" | "exclude";
  label: string;
  placeholder: string;
  /** How the terms combine, which the label alone does not say. */
  help: string;
}) {
  const id = `keyword-filter-${name}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {/* A real label bound to the input, not a lookalike span: the design's
          rule is that the label is always visible AND tied to the control. */}
      <label htmlFor={id} style={GROUP_LABEL}>
        {label}
      </label>
      <form.Field name={name}>
        {(field) => (
          <FilterInput
            id={id}
            describedBy={`${id}-help`}
            value={field.state.value}
            placeholder={placeholder}
            onChange={(value) => field.handleChange(value)}
          />
        )}
      </form.Field>
      <span id={`${id}-help`} style={HELP_TEXT}>
        {help}
      </span>
    </div>
  );
}

function RangeFilter({
  form,
  label,
  minName,
  maxName,
  step,
  disabledReason,
}: {
  form: FiltersForm;
  label: string;
  minName: RangeName;
  maxName: RangeName;
  step?: string;
  disabledReason?: string;
}) {
  const groupId = `keyword-filter-${minName}-group`;
  const reasonId = `${groupId}-reason`;

  return (
    // One visible label covers a pair of inputs, so the pair is a labelled
    // group and each input keeps its own name inside it.
    <div
      role="group"
      aria-labelledby={groupId}
      aria-describedby={disabledReason ? reasonId : undefined}
      style={{ display: "flex", flexDirection: "column", gap: 5 }}
      title={disabledReason}
    >
      <span id={groupId} style={GROUP_LABEL}>
        {label}
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {[
          { name: minName, placeholder: "Min" },
          { name: maxName, placeholder: "Max" },
        ].map((bound) => (
          <form.Field key={bound.name} name={bound.name}>
            {(field) => (
              <FilterInput
                type="number"
                step={step}
                ariaLabel={`${label} ${bound.placeholder.toLowerCase()}`}
                describedBy={disabledReason ? reasonId : undefined}
                value={field.state.value}
                placeholder={bound.placeholder}
                disabled={disabledReason !== undefined}
                onChange={(value) => field.handleChange(value)}
              />
            )}
          </form.Field>
        ))}
      </div>
      {disabledReason ? (
        <span id={reasonId} style={HELP_TEXT}>
          {disabledReason}
        </span>
      ) : null}
    </div>
  );
}

function IntentFilter({
  form,
  disabledReason,
}: {
  form: FiltersForm;
  disabledReason?: string;
}) {
  return (
    <div
      role="group"
      aria-labelledby="keyword-intent-filter-label"
      aria-describedby={
        disabledReason ? "keyword-intent-filter-reason" : undefined
      }
      style={{ display: "flex", flexDirection: "column", gap: 5 }}
    >
      <span style={GROUP_LABEL} id="keyword-intent-filter-label">
        Intent
      </span>
      <form.Field name="intents">
        {(field) => {
          const selected = parseIntentFilter(field.state.value);
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {KEYWORD_INTENT_ORDER.map((intent) => (
                <Chip
                  key={intent}
                  shape="chip"
                  active={selected.includes(intent)}
                  aria-pressed={selected.includes(intent)}
                  disabled={disabledReason !== undefined}
                  title={disabledReason}
                  onClick={() =>
                    field.handleChange(
                      toggleIntentFilter(field.state.value, intent),
                    )
                  }
                >
                  {INTENT_LABELS[intent]}
                </Chip>
              ))}
            </div>
          );
        }}
      </form.Field>
      {disabledReason ? (
        <span id="keyword-intent-filter-reason" style={HELP_TEXT}>
          {disabledReason}
        </span>
      ) : null}
    </div>
  );
}
