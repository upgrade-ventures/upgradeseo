import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import {
  FilterNumberInput,
  FilterRangeGroup,
  FilterTextInput,
} from "@/client/features/domain/components/DomainFilterFields";
import {
  debugDomain,
  useDomainRenderDebug,
} from "@/client/features/domain/domainDebug";
import { MAX_FILTER_CONDITIONS } from "@/types/schemas/domain";

type FilterValues = Record<string, string>;

type FilterTextField<TValues extends FilterValues> = {
  key: keyof TValues;
  label: string;
  placeholder: string;
};

type FilterRangeField<TValues extends FilterValues> = {
  title: string;
  minKey: keyof TValues;
  maxKey: keyof TValues;
  step?: string;
};

type Props<TValues extends FilterValues> = {
  debugName: string;
  activeFilterCount: number;
  appliedFilters: TValues;
  fields: ReadonlyArray<keyof TValues>;
  textFields: ReadonlyArray<FilterTextField<TValues>>;
  rangeFields: ReadonlyArray<FilterRangeField<TValues>>;
  countConditions: (values: TValues) => number;
  onApply: (values: TValues) => void;
  onClear: () => void;
  /** Extra feature-specific controls (toggles etc.) bound to the draft. */
  renderExtra?: (
    draft: TValues,
    setValue: (key: keyof TValues, value: string) => void,
  ) => ReactNode;
};

/**
 * Both include/exclude fields are split on commas and plus signs, and every
 * term spends one of the request's filter conditions. Neither fact is visible
 * from the field, so the design's rule applies: help text wherever the
 * requirement is not obvious.
 */
const TERMS_HELP =
  "Separate terms with a comma. Each term spends one filter condition.";

/** Small count pill, on the design's pill geometry. */
function CountPill({
  tone,
  children,
}: {
  tone: "accent" | "warning";
  children: ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: `var(--${tone})`,
        background: `var(--${tone}-soft)`,
        border: `1px solid var(--${tone}-border)`,
      }}
    >
      {children}
    </span>
  );
}

export function DomainFilterPanel<TValues extends FilterValues>({
  debugName,
  activeFilterCount,
  appliedFilters,
  fields,
  textFields,
  rangeFields,
  countConditions,
  onApply,
  onClear,
  renderExtra,
}: Props<TValues>) {
  const uid = useId();
  const appliedKey = useMemo(
    () => fields.map((key) => appliedFilters[key]).join("|"),
    [appliedFilters, fields],
  );
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  useEffect(() => {
    setDraftFilters(appliedFilters);
    // appliedKey covers content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey]);

  const meta = useMemo(
    () =>
      getFilterMeta({
        values: draftFilters,
        appliedFilters,
        fields,
        countConditions,
      }),
    [appliedFilters, countConditions, draftFilters, fields],
  );
  useDomainRenderDebug(debugName, {
    activeFilterCount,
    conditionCount: meta.conditionCount,
    dirtyCount: meta.dirtyCount,
  });
  const applyFilters = useCallback(() => {
    if (meta.overLimit) return;
    debugDomain(`${debugName}:apply`, {
      conditionCount: meta.conditionCount,
      dirtyCount: meta.dirtyCount,
      draftFilters,
    });
    onApply(draftFilters);
  }, [
    debugName,
    draftFilters,
    meta.conditionCount,
    meta.dirtyCount,
    meta.overLimit,
    onApply,
  ]);
  const cancelFilterEdits = useCallback(() => {
    debugDomain(`${debugName}:cancel`);
    setDraftFilters(appliedFilters);
  }, [appliedFilters, debugName]);
  const resetFilters = useCallback(() => {
    debugDomain(`${debugName}:clear`);
    // Also clear unapplied draft edits — when the applied filters are already
    // empty, the applied-sync effect won't fire (appliedKey is unchanged).
    setDraftFilters((current) => {
      const next = { ...current };
      for (const key of fields) Object.assign(next, { [key]: "" });
      return next;
    });
    onClear();
  }, [debugName, fields, onClear]);
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter") return;
    // Let buttons (Cancel, toggles) handle their own Enter activation.
    if (event.target instanceof HTMLButtonElement) return;
    if (meta.overLimit) return;
    event.preventDefault();
    applyFilters();
  };
  const handleValueChange = useCallback(
    (key: keyof TValues, value: string) => {
      debugDomain(`${debugName}:draft-change`, {
        field: String(key),
        valueLength: value.length,
      });
      setDraftFilters((current) => ({ ...current, [key]: value }));
    },
    [debugName],
  );

  // The design's rule for a disabled control: it says why it is off, it is
  // never just greyed out.
  const applyDisabledReason = meta.overLimit
    ? `Remove a term or a bound: at most ${MAX_FILTER_CONDITIONS} filter conditions are accepted per request.`
    : !meta.isDirty
      ? "Change a filter to apply it."
      : null;

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{
        display: "grid",
        gap: 12,
        padding: "12px var(--pad, 24px)",
        background: "var(--subtle)",
        borderBottom: "1px solid var(--line)",
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
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            Refine table results
          </h3>
          {activeFilterCount > 0 ? (
            <CountPill tone="accent">{activeFilterCount} active</CountPill>
          ) : null}
          {meta.dirtyCount > 0 ? (
            <CountPill tone="warning">{meta.dirtyCount} unapplied</CountPill>
          ) : null}
        </div>
        <SecondaryButton
          icon="i-refresh"
          onClick={resetFilters}
          disabled={activeFilterCount === 0 && !meta.isDirty}
          title={
            activeFilterCount === 0 && !meta.isDirty
              ? "Nothing is filtered yet."
              : undefined
          }
        >
          Clear all
        </SecondaryButton>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        {textFields.map((field) => (
          <FilterTextInput
            key={String(field.key)}
            label={field.label}
            help={TERMS_HELP}
            placeholder={field.placeholder}
            value={draftFilters[field.key]}
            onChange={(value) => handleValueChange(field.key, value)}
          />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {rangeFields.map((field) => (
          <FilterRangeGroup key={String(field.minKey)} title={field.title}>
            <FilterNumberInput
              id={`${uid}-${String(field.minKey)}`}
              label="Min"
              value={draftFilters[field.minKey]}
              onChange={(value) => handleValueChange(field.minKey, value)}
              placeholder="Any"
              step={field.step}
            />
            <FilterNumberInput
              id={`${uid}-${String(field.maxKey)}`}
              label="Max"
              value={draftFilters[field.maxKey]}
              onChange={(value) => handleValueChange(field.maxKey, value)}
              placeholder="Any"
              step={field.step}
            />
          </FilterRangeGroup>
        ))}
      </div>

      {renderExtra ? renderExtra(draftFilters, handleValueChange) : null}

      {/* Announced rather than only drawn: the limit is crossed while typing,
          far from the button it disables. */}
      <div aria-live="polite">
        {meta.overLimit ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              padding: "9px 12px",
              border: "1px solid var(--warning-border)",
              background: "var(--warning-soft)",
              borderRadius: 6,
              fontSize: 12.5,
              color: "var(--text)",
            }}
          >
            <Icon
              name="i-alert"
              size={15}
              style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }}
            />
            <span>
              Too many filter conditions ({meta.conditionCount} of{" "}
              {MAX_FILTER_CONDITIONS} max). Remove some terms or ranges before
              applying.
            </span>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.01em",
          }}
        >
          {meta.conditionCount} / {MAX_FILTER_CONDITIONS} conditions
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SecondaryButton
            onClick={cancelFilterEdits}
            disabled={!meta.isDirty}
            title={meta.isDirty ? undefined : "No unapplied changes."}
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onClick={applyFilters}
            disabled={!meta.isDirty || meta.overLimit}
            title={applyDisabledReason ?? undefined}
          >
            Apply filters
            {meta.isDirty ? ` (${meta.dirtyCount})` : ""}
          </PrimaryButton>
        </div>
      </div>

      {applyDisabledReason ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--text-2)",
            textAlign: "right",
          }}
        >
          {applyDisabledReason}
        </p>
      ) : null}
    </div>
  );
}

function getFilterMeta<TValues extends FilterValues>({
  values,
  appliedFilters,
  fields,
  countConditions,
}: {
  values: TValues;
  appliedFilters: TValues;
  fields: ReadonlyArray<keyof TValues>;
  countConditions: (values: TValues) => number;
}) {
  const conditionCount = countConditions(values);
  const dirtyCount = fields.reduce(
    (acc, key) =>
      acc + (values[key].trim() !== appliedFilters[key].trim() ? 1 : 0),
    0,
  );
  return {
    conditionCount,
    dirtyCount,
    isDirty: dirtyCount > 0,
    overLimit: conditionCount > MAX_FILTER_CONDITIONS,
  };
}
