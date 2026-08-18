import { useId } from "react";
import {
  Field,
  SelectInput,
  TextInput,
} from "@/client/components/prominence/Field";
import { SmallButton } from "./RankScreenParts";
import type { DomainListFilters, Filters } from "./RankTrackingFilters.logic";

export * from "./RankTrackingFilters.logic";

type DomainListFilterOption = {
  value: string;
  label: string;
};

/** Muted count of the filters currently narrowing the table. */
function ActiveCount({ count }: { count: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 18,
        padding: "0 7px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: "var(--accent)",
        background: "var(--accent-soft)",
        border: "1px solid var(--accent-border)",
      }}
    >
      {count} active
    </span>
  );
}

export function FilterPanel({
  filters,
  setFilters,
  activeFilterCount,
  onReset,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  activeFilterCount: number;
  onReset: () => void;
}) {
  const update = (key: keyof Filters, value: string) =>
    setFilters({ ...filters, [key]: value });

  return (
    // A band, like the views bar above it: same gutter, same hairline, no
    // gradient of its own.
    <div
      style={{
        padding: "10px var(--pad,24px)",
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            Refine results
          </h3>
          {activeFilterCount > 0 ? (
            <ActiveCount count={activeFilterCount} />
          ) : null}
        </div>
        <SmallButton
          tone="ghost"
          onClick={onReset}
          disabled={activeFilterCount === 0}
          title={
            activeFilterCount === 0
              ? "No filter is narrowing the table"
              : "Show every tracked keyword again"
          }
        >
          Clear all
        </SmallButton>
      </div>

      <div style={GRID_2}>
        <Field
          label="Include"
          description="Only keywords containing one of these words. Separate with commas."
        >
          {(control) => (
            <TextInput
              {...control}
              placeholder="seo, tool"
              value={filters.include}
              onChange={(event) => update("include", event.target.value)}
            />
          )}
        </Field>
        <Field
          label="Exclude"
          description="Hide keywords containing any of these words."
        >
          {(control) => (
            <TextInput
              {...control}
              placeholder="free, cheap"
              value={filters.exclude}
              onChange={(event) => update("exclude", event.target.value)}
            />
          )}
        </Field>
      </div>

      <div style={GRID_2}>
        <RangeFilter
          title="Desktop position"
          hint="1 is the top of page one."
          minValue={filters.minDesktopPos}
          maxValue={filters.maxDesktopPos}
          onMinChange={(value) => update("minDesktopPos", value)}
          onMaxChange={(value) => update("maxDesktopPos", value)}
        />
        <RangeFilter
          title="Mobile position"
          hint="1 is the top of page one."
          minValue={filters.minMobilePos}
          maxValue={filters.maxMobilePos}
          onMinChange={(value) => update("minMobilePos", value)}
          onMaxChange={(value) => update("maxMobilePos", value)}
        />
      </div>

      <div style={GRID_3}>
        <RangeFilter
          title="Volume"
          hint="Monthly searches."
          minValue={filters.minVolume}
          maxValue={filters.maxVolume}
          onMinChange={(value) => update("minVolume", value)}
          onMaxChange={(value) => update("maxVolume", value)}
        />
        <RangeFilter
          title="Keyword difficulty"
          hint="0 to 100."
          minValue={filters.minKd}
          maxValue={filters.maxKd}
          onMinChange={(value) => update("minKd", value)}
          onMaxChange={(value) => update("maxKd", value)}
        />
        <RangeFilter
          title="CPC"
          hint="Cost per click, in the account currency."
          minValue={filters.minCpc}
          maxValue={filters.maxCpc}
          onMinChange={(value) => update("minCpc", value)}
          onMaxChange={(value) => update("maxCpc", value)}
        />
      </div>
    </div>
  );
}

export function DomainListFilterBar({
  filters,
  options,
  activeFilterCount,
  onChange,
  onReset,
}: {
  filters: DomainListFilters;
  options: {
    devices: DomainListFilterOption[];
    locations: DomainListFilterOption[];
  };
  activeFilterCount: number;
  onChange: (filters: DomainListFilters) => void;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        padding: "10px var(--pad,24px)",
        borderBottom: "1px solid var(--line)",
        background: "var(--subtle)",
        display: "flex",
        gap: 12,
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <Field label="Search" style={{ flex: "1 1 220px", minWidth: 0 }}>
        {(control) => (
          <TextInput
            {...control}
            placeholder="Domain or website"
            value={filters.query}
            onChange={(event) =>
              onChange({ ...filters, query: event.target.value })
            }
          />
        )}
      </Field>

      <Field label="Device" style={{ flex: "0 1 180px", minWidth: 0 }}>
        {(control) => (
          <SelectInput
            {...control}
            value={filters.device}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "all" ||
                value === "both" ||
                value === "desktop" ||
                value === "mobile"
              ) {
                onChange({ ...filters, device: value });
              }
            }}
          >
            <option value="all">All devices</option>
            {options.devices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>

      <Field label="Country" style={{ flex: "0 1 210px", minWidth: 0 }}>
        {(control) => (
          <SelectInput
            {...control}
            value={filters.locationCode}
            onChange={(event) =>
              onChange({ ...filters, locationCode: event.target.value })
            }
          >
            <option value="all">All countries</option>
            {options.locations.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>

      {activeFilterCount > 0 ? (
        <SmallButton
          onClick={onReset}
          style={{ minHeight: 30 }}
          title="Show every tracked domain again"
        >
          Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
        </SmallButton>
      ) : null}
    </div>
  );
}

const GRID_2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const GRID_3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 12,
};

/**
 * A min/max pair.
 *
 * Both ends are real fields with their own visible label, so a screen reader
 * hears "Volume, minimum" rather than two unnamed number boxes under a heading
 * it was never told about.
 */
function RangeFilter({
  title,
  hint,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  title: string;
  hint: string;
  minValue: string;
  maxValue: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
}) {
  const groupId = useId();
  return (
    <div
      role="group"
      aria-labelledby={groupId}
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--subtle)",
        padding: 10,
      }}
    >
      <div
        id={groupId}
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {title}
      </div>
      <div
        style={{ fontSize: 11.5, color: "var(--text-2)", margin: "2px 0 6px" }}
      >
        {hint}
      </div>
      {/* Both ends are labelled "Min"/"Max" in the group the heading names, so
          the label stays visible and short while the group supplies the rest of
          the sentence to a screen reader. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field label="Min">
          {(control) => (
            <TextInput
              {...control}
              type="number"
              inputMode="numeric"
              value={minValue}
              onChange={(event) => onMinChange(event.target.value)}
            />
          )}
        </Field>
        <Field label="Max">
          {(control) => (
            <TextInput
              {...control}
              type="number"
              inputMode="numeric"
              value={maxValue}
              onChange={(event) => onMaxChange(event.target.value)}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
