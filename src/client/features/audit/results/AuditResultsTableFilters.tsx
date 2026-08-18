import { useId, type CSSProperties, type ReactNode } from "react";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { focusRing } from "@/client/features/audit/auditStyles";
import type {
  PagesFilters,
  PerformanceFilters,
} from "@/client/features/audit/results/AuditResultsTableFilterLogic";

/**
 * The table toolbars.
 *
 * The design draws no filters at all, because the crawl it shows is a fixture.
 * Filtering a real thousand-page inventory is not optional, so the controls
 * stay and are restyled onto the design's band, gutter and control rules.
 */

const FIELD: CSSProperties = {
  width: "100%",
  minHeight: 28,
  padding: "4px 8px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 12.5,
  fontFamily: "inherit",
  outline: "none",
};

const FIELD_LABEL: CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-3)",
};

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

export function TableFilterToggle({
  showFilters,
  onToggle,
  activeFilterCount,
  resultCount,
  totalCount,
  label,
}: {
  showFilters: boolean;
  onToggle: () => void;
  activeFilterCount: number;
  resultCount: number;
  totalCount: number;
  /** Plural noun for the counted rows, e.g. "pages". */
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px var(--pad, 24px)",
        borderBottom: "1px solid var(--line)",
        background: "var(--subtle)",
        flexWrap: "wrap",
      }}
    >
      <SecondaryButton
        icon="i-filter"
        onClick={onToggle}
        aria-expanded={showFilters}
        style={
          showFilters
            ? {
                background: "var(--inset)",
                borderColor: "var(--border-strong)",
              }
            : undefined
        }
      >
        Filters
        {activeFilterCount > 0 ? (
          <span
            style={{
              marginLeft: 6,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
              color: "var(--accent)",
            }}
          >
            {activeFilterCount}
          </span>
        ) : null}
      </SecondaryButton>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 12,
          color: "var(--text-2)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {resultCount.toLocaleString()} of {totalCount.toLocaleString()} {label}
      </span>
    </div>
  );
}

export function PagesFilterBar({
  filters,
  onChange,
  activeFilterCount,
  onReset,
}: {
  filters: PagesFilters;
  onChange: (filters: PagesFilters) => void;
  activeFilterCount: number;
  onReset: () => void;
}) {
  return (
    <FilterPanel activeFilterCount={activeFilterCount} onReset={onReset}>
      <div style={GRID}>
        <TextFilter
          label="Search"
          value={filters.query}
          placeholder="URL, title, meta"
          onChange={(query) => onChange({ ...filters, query })}
        />
        <SelectFilter
          label="Status"
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
          options={[
            ["all", "All"],
            ["ok", "2xx"],
            ["redirect", "3xx"],
            ["error", "4xx/5xx"],
            ["missing", "Missing"],
          ]}
        />
        <SelectFilter
          label="Alt text"
          value={filters.missingAlt}
          onChange={(missingAlt) => onChange({ ...filters, missingAlt })}
          options={[
            ["all", "All"],
            ["yes", "Missing alt"],
            ["no", "No missing alt"],
          ]}
        />
        <RangeFilter
          label="Words"
          min={filters.minWords}
          max={filters.maxWords}
          onMinChange={(minWords) => onChange({ ...filters, minWords })}
          onMaxChange={(maxWords) => onChange({ ...filters, maxWords })}
        />
        <RangeFilter
          label="Response ms"
          min={filters.minResponseMs}
          max={filters.maxResponseMs}
          onMinChange={(minResponseMs) =>
            onChange({ ...filters, minResponseMs })
          }
          onMaxChange={(maxResponseMs) =>
            onChange({ ...filters, maxResponseMs })
          }
        />
      </div>
    </FilterPanel>
  );
}

export function PerformanceFilterBar({
  filters,
  onChange,
  activeFilterCount,
  onReset,
}: {
  filters: PerformanceFilters;
  onChange: (filters: PerformanceFilters) => void;
  activeFilterCount: number;
  onReset: () => void;
}) {
  return (
    <FilterPanel activeFilterCount={activeFilterCount} onReset={onReset}>
      <div style={GRID}>
        <TextFilter
          label="Search"
          value={filters.query}
          placeholder="URL"
          onChange={(query) => onChange({ ...filters, query })}
        />
        <SelectFilter
          label="Device"
          value={filters.device}
          onChange={(device) => onChange({ ...filters, device })}
          options={[
            ["all", "All"],
            ["desktop", "Desktop"],
            ["mobile", "Mobile"],
          ]}
        />
        <SelectFilter
          label="Run"
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
          options={[
            ["all", "All"],
            // The filter's stored token stays "ok"; the label it shows is the
            // vocabulary's word for the state it filters to.
            ["ok", "Finished"],
            ["failed", "Failed"],
          ]}
        />
        <TextFilter
          label="Max LCP s"
          value={filters.maxLcpSeconds}
          placeholder="2.5"
          type="number"
          onChange={(maxLcpSeconds) => onChange({ ...filters, maxLcpSeconds })}
        />
        <RangeFilter
          label="Perf"
          min={filters.minPerf}
          max={filters.maxPerf}
          onMinChange={(minPerf) => onChange({ ...filters, minPerf })}
          onMaxChange={(maxPerf) => onChange({ ...filters, maxPerf })}
        />
        <RangeFilter
          label="SEO"
          min={filters.minSeo}
          max={filters.maxSeo}
          onMinChange={(minSeo) => onChange({ ...filters, minSeo })}
          onMaxChange={(maxSeo) => onChange({ ...filters, maxSeo })}
        />
      </div>
    </FilterPanel>
  );
}

export function countActiveFilters<TFilters extends Record<string, string>>(
  filters: TFilters,
  emptyFilters: TFilters,
) {
  return Object.keys(filters).reduce((count, key) => {
    const filterKey = key as keyof TFilters;
    return filters[filterKey] !== emptyFilters[filterKey] ? count + 1 : count;
  }, 0);
}

function FilterPanel({
  activeFilterCount,
  onReset,
  children,
}: {
  activeFilterCount: number;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "12px var(--pad, 24px)",
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>Refine results</span>
        <SecondaryButton onClick={onReset} disabled={activeFilterCount === 0}>
          Clear all
        </SecondaryButton>
      </div>
      {children}
    </div>
  );
}

function TextFilter({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: "text" | "number";
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={FIELD_LABEL}>
        {label}
      </label>
      <input
        id={id}
        style={FIELD}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        {...focusRing<HTMLInputElement>()}
      />
    </div>
  );
}

/**
 * Two bounds under one visible name.
 *
 * The name belongs to the pair rather than to either input, so it labels a
 * group and each input carries its own accessible name inside it. A single
 * `<label>` here would have named only one of the two.
 */
function RangeFilter({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const labelId = useId();
  const minId = useId();
  const maxId = useId();
  return (
    <div role="group" aria-labelledby={labelId}>
      <span id={labelId} style={FIELD_LABEL}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          id={minId}
          style={FIELD}
          type="number"
          value={min}
          placeholder="Min"
          aria-label={`${label} minimum`}
          onChange={(event) => onMinChange(event.target.value)}
          {...focusRing<HTMLInputElement>()}
        />
        <input
          id={maxId}
          style={FIELD}
          type="number"
          value={max}
          placeholder="Max"
          aria-label={`${label} maximum`}
          onChange={(event) => onMaxChange(event.target.value)}
          {...focusRing<HTMLInputElement>()}
        />
      </div>
    </div>
  );
}

function SelectFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={FIELD_LABEL}>
        {label}
      </label>
      <select
        id={id}
        style={FIELD}
        value={value}
        onChange={(event) => {
          const selected = options.find(
            ([optionValue]) => optionValue === event.target.value,
          )?.[0];
          if (selected != null) onChange(selected);
        }}
        {...focusRing<HTMLSelectElement>()}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
