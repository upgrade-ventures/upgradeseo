import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { SerpLocationCombobox } from "@/client/components/SerpLocationCombobox";
import { Icon } from "@/client/components/icons/IconSprite";
import { prewarmSerpLocations } from "@/serverFunctions/serp-locations";

type TargetingMode = "national" | "local";

/**
 * A choice between two options is a radiogroup, not a pair of loose radios: the
 * group carries the visible name and the radios carry their own labels, so the
 * name is announced once rather than not at all.
 */
export function SearchTargetingField({
  mode,
  onModeChange,
  locationName,
  onLocationNameChange,
  countryCode,
  error,
}: {
  mode: TargetingMode;
  onModeChange: (mode: TargetingMode) => void;
  locationName: string | undefined;
  onLocationNameChange: (locationName: string | undefined) => void;
  countryCode: string;
  /** Shown below the group and announced, once the choice has been made. */
  error?: string | null;
}) {
  const groupId = useId();
  const errorId = `${groupId}-error`;

  // Warm the server-side location cache the moment Local targeting is in
  // play, so the country list is hot before the first keystroke. Best-effort:
  // a failed warm just means the first search is slower, so no retries, and
  // staleTime keeps one warm per country per session.
  useQuery({
    queryKey: ["serp-locations-prewarm", countryCode],
    queryFn: () => prewarmSerpLocations({ data: { countryCode } }),
    enabled: mode === "local",
    staleTime: Infinity,
    retry: false,
  });

  return (
    <div>
      <div id={groupId} style={{ fontSize: 12.5, fontWeight: 600 }}>
        Search targeting
      </div>
      <div
        style={{ fontSize: 12, color: "var(--text-2)", margin: "2px 0 6px" }}
      >
        {mode === "local"
          ? "Best for “near me” queries, city keywords and service-area pages."
          : "Local targeting can understate rankings for terms with no place in them."}
      </div>

      <div
        role="radiogroup"
        aria-labelledby={groupId}
        aria-describedby={error ? errorId : undefined}
        style={{ display: "flex", gap: 16 }}
      >
        {(["national", "local"] as const).map((option) => (
          <label
            key={option}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name={`${groupId}-mode`}
              checked={mode === option}
              onChange={() => {
                onModeChange(option);
                if (option === "national") onLocationNameChange(undefined);
              }}
              style={{ accentColor: "var(--accent)", cursor: "pointer" }}
            />
            {option === "national" ? "National" : "Local"}
          </label>
        ))}
      </div>

      {mode === "local" ? (
        <div style={{ marginTop: 8 }}>
          <SerpLocationCombobox
            value={locationName}
            onChange={onLocationNameChange}
            countryCode={countryCode}
            placeholder="Search cities..."
          />
        </div>
      ) : null}

      {/* Always mounted, so the message is an update to a live region. */}
      <div id={errorId} aria-live="polite">
        {error ? (
          <div
            style={{
              marginTop: 5,
              display: "flex",
              gap: 6,
              alignItems: "flex-start",
              fontSize: 12,
              color: "var(--danger)",
            }}
          >
            <Icon
              name="i-alert"
              size={14}
              style={{ marginTop: 1, strokeWidth: 1.5 }}
            />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
