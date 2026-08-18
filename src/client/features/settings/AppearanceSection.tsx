import { useRef, useSyncExternalStore } from "react";

import {
  EYEBROW,
  useFocusRing,
} from "@/client/features/settings/settingsParts";
import { type ThemePreference, useThemePreference } from "@/client/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemScheme(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Live OS colour scheme, so the note under "Theme" keeps telling the truth
 * while the preference is "system" and the device flips at sunset.
 */
function useSystemDark() {
  return useSyncExternalStore(
    subscribeToSystemScheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

export function AppearanceSection() {
  const { themePreference, setThemePreference } = useThemePreference();
  const systemDark = useSystemDark();
  const groupRef = useRef<HTMLDivElement>(null);

  const resolvedNote =
    themePreference === "system"
      ? `Following your device: ${systemDark ? "dark" : "light"}`
      : `Always ${themePreference}`;

  // Arrow keys move between radios, as a radiogroup is expected to. Only the
  // checked radio is tabbable, so Tab enters and leaves the group once.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = OPTIONS.findIndex(
      (option) => option.value === themePreference,
    );
    const nextIndex = (index + step + OPTIONS.length) % OPTIONS.length;
    const next = OPTIONS[nextIndex];
    if (!next) return;
    setThemePreference(next.value);
    groupRef.current?.querySelectorAll("button")[nextIndex]?.focus();
  };

  return (
    <section>
      <h2 style={EYEBROW}>Appearance</h2>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Theme</div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>
            {resolvedNote}
          </div>
        </div>
        <div
          ref={groupRef}
          role="radiogroup"
          aria-label="Theme preference"
          onKeyDown={handleKeyDown}
          style={{
            display: "flex",
            gap: 2,
            padding: 2,
            border: "1px solid var(--line)",
            borderRadius: 7,
            background: "var(--subtle)",
          }}
        >
          {OPTIONS.map((option) => (
            <ThemeOption
              key={option.value}
              label={option.label}
              active={option.value === themePreference}
              onSelect={() => setThemePreference(option.value)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ThemeOption({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      {...focusProps}
      style={{
        minHeight: 24,
        padding: "3px 11px",
        border: "none",
        borderRadius: 5,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: "pointer",
        whiteSpace: "nowrap",
        outline: "none",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-2)",
        fontWeight: active ? 600 : 400,
        boxShadow:
          focusRing ?? (active ? "0 1px 2px rgba(20,24,28,.10)" : "none"),
      }}
    >
      {label}
    </button>
  );
}
