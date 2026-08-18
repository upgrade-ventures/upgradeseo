import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "@/client/components/icons/IconSprite";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import {
  GSC_DEVICES,
  SEARCH_PERFORMANCE_RANGES,
  type SearchPerformanceDateRange,
  type SearchPerformanceDevice,
} from "@/types/schemas/search-performance";

/** Sentinel for "no filter" in the selects; never sent to the server. */
export const ALL = "ALL";

export const RANGE_LABELS: Record<SearchPerformanceDateRange, string> = {
  last_7_days: "Last 7 days",
  last_28_days: "Last 28 days",
  last_3_months: "Last 3 months",
};

/** The subtitle's "vs." phrase. The server compares against the window of equal
 *  length immediately before the selected one (see previousPeriod). */
export const COMPARISON_LABELS: Record<SearchPerformanceDateRange, string> = {
  last_7_days: "the previous 7 days",
  last_28_days: "the previous 28 days",
  last_3_months: "the previous 3 months",
};

const DEVICE_LABELS: Record<SearchPerformanceDevice, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
  TABLET: "Tablet",
};

/** The design's select: a native control wearing the token border and type. */
const SELECT_STYLE: React.CSSProperties = {
  minHeight: 28,
  padding: "4px 8px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 12.5,
};

export function deviceLabel(device: SearchPerformanceDevice): string {
  return DEVICE_LABELS[device];
}

function isDateRange(value: string): value is SearchPerformanceDateRange {
  return SEARCH_PERFORMANCE_RANGES.some((option) => option === value);
}

function isDevice(value: string): value is SearchPerformanceDevice {
  return GSC_DEVICES.some((option) => option === value);
}

/**
 * One filter select.
 *
 * The design gives the header selects a label through `aria-label` rather than a
 * visible `<label>`; the header band has no room for a caption row and the
 * reference's own control is written that way. A disabled select still says why
 * it is off, since the design forbids a control that is silently dead.
 */
function FilterSelect({
  label,
  value,
  onChange,
  disabled,
  disabledReason,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  children: React.ReactNode;
}) {
  // :focus-visible cannot be expressed inline, and matching it here keeps the
  // ring off a plain mouse click.
  const [focusRing, setFocusRing] = useState(false);

  return (
    <select
      aria-label={
        disabled && disabledReason ? `${label}: ${disabledReason}` : label
      }
      title={disabled ? disabledReason : undefined}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) =>
        setFocusRing(event.currentTarget.matches(":focus-visible"))
      }
      onBlur={() => setFocusRing(false)}
      // The design's 28px control is below the 44px touch floor, and a media
      // query cannot be written inline.
      className="max-sm:min-h-11"
      style={{
        ...SELECT_STYLE,
        ...(disabled ? { opacity: 0.55 } : null),
        ...(focusRing ? { outline: "none", boxShadow: "var(--focus)" } : null),
      }}
    >
      {children}
    </select>
  );
}

/**
 * The header's action cluster: the two breakdown filters, the range, and the
 * export.
 *
 * A filter is disabled on the tab that already splits the report by that same
 * dimension, since applying both would report one device's numbers under three
 * device rows.
 */
export function SearchPerformanceToolbar({
  projectId,
  connected,
  refreshing,
  range,
  onRangeChange,
  device,
  onDeviceChange,
  deviceDisabled,
  country,
  onCountryChange,
  countryDisabled,
  countryOptions,
  exportReason,
  exporting,
  onExport,
}: {
  projectId: string;
  connected: boolean;
  refreshing: boolean;
  range: SearchPerformanceDateRange;
  onRangeChange: (value: SearchPerformanceDateRange) => void;
  device: SearchPerformanceDevice | typeof ALL;
  onDeviceChange: (value: SearchPerformanceDevice | typeof ALL) => void;
  deviceDisabled: boolean;
  country: string;
  onCountryChange: (value: string) => void;
  countryDisabled: boolean;
  countryOptions: string[];
  /** Why the export is unavailable; undefined when it can run. */
  exportReason?: string;
  exporting: boolean;
  onExport: () => void;
}) {
  return (
    // The design's action row carries two controls; this screen keeps four, so
    // the cluster wraps rather than pushing the page into a sideways scroll.
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {refreshing ? (
        <span
          role="status"
          aria-label="Refreshing"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <Icon
            name="i-refresh"
            size={13}
            style={{
              color: "var(--text-3)",
              animation: "spin 1s linear infinite",
            }}
          />
        </span>
      ) : null}

      <FilterSelect
        label="Device filter"
        value={device}
        disabled={deviceDisabled}
        disabledReason="the Devices tab already splits the report by device"
        onChange={(value) => onDeviceChange(isDevice(value) ? value : ALL)}
      >
        <option value={ALL}>All devices</option>
        {GSC_DEVICES.map((value) => (
          <option key={value} value={value}>
            {DEVICE_LABELS[value]}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Country filter"
        value={country}
        disabled={countryDisabled}
        disabledReason="the Countries tab always reports every country"
        onChange={onCountryChange}
      >
        <option value={ALL}>All countries</option>
        {countryOptions.map((code) => (
          <option key={code} value={code}>
            {code.toUpperCase()}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Date range"
        value={range}
        onChange={(value) => {
          if (isDateRange(value)) onRangeChange(value);
        }}
      >
        {SEARCH_PERFORMANCE_RANGES.map((value) => (
          <option key={value} value={value}>
            {RANGE_LABELS[value]}
          </option>
        ))}
      </FilterSelect>

      <SecondaryButton
        onClick={onExport}
        disabled={exportReason != null || exporting}
        title={exportReason}
        // A disabled button drops out of the tab order, so the reason has to
        // ride on the name for anyone reading the page rather than pointing at
        // it.
        aria-label={exportReason ? `Export CSV: ${exportReason}` : "Export CSV"}
        className="prominence-button-secondary max-sm:min-h-11"
      >
        {exporting ? "Exporting…" : "Export CSV"}
      </SecondaryButton>

      {connected ? (
        <Link
          to="/p/$projectId/settings"
          params={{ projectId }}
          hash="search-console"
          className="max-sm:min-h-11"
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 12.5,
            color: "var(--text-2)",
            whiteSpace: "nowrap",
          }}
        >
          Change property
        </Link>
      ) : null}
    </div>
  );
}
