import { useState } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import {
  TextInput,
  useFocusRing,
} from "@/client/features/onboarding/onboardingControls";

/**
 * The answer list for one onboarding question, plus the two option shapes it
 * draws. The design has no answer list of its own, so these carry the token
 * set the rest of the screen uses: a selected option takes the accent tint the
 * design gives to chosen state elsewhere.
 */

function ChoiceOption({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { ring, ringProps } = useFocusRing();
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      {...ringProps}
      // The design's 32px row is below the 44px touch floor, and a media query
      // cannot be written inline.
      className="max-sm:min-h-11"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        width: "100%",
        minHeight: 32,
        padding: "5px 10px",
        borderRadius: 6,
        textAlign: "left",
        fontFamily: "inherit",
        fontSize: 12.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        border: selected
          ? "1px solid var(--accent-border)"
          : "1px solid var(--line)",
        background: selected ? "var(--accent-soft)" : "var(--surface)",
        color: selected ? "var(--text)" : "var(--text-2)",
        ...(hover && !disabled && !selected
          ? { borderColor: "var(--border-strong)" }
          : null),
        ...ring,
      }}
    >
      <span>{label}</span>
      {selected ? (
        <Icon name="i-check" size={12} style={{ color: "var(--accent)" }} />
      ) : null}
    </button>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const { ring, ringProps } = useFocusRing();

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      {...ringProps}
      className="max-sm:min-h-11"
      style={{
        minHeight: 24,
        padding: "2px 9px",
        borderRadius: 6,
        fontFamily: "inherit",
        fontSize: 12,
        cursor: "pointer",
        border: selected
          ? "1px solid var(--accent-border)"
          : "1px solid var(--line)",
        background: selected ? "var(--accent-soft)" : "var(--surface)",
        color: selected ? "var(--accent)" : "var(--text-2)",
        ...ring,
      }}
    >
      {label}
    </button>
  );
}

type ChoiceFollowUp = {
  /** The option that reveals the follow-up. */
  showForValue: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
};

/**
 * The answer list for one onboarding question. Keeps the behaviour the wizard
 * had: a selection cap, an "Other" free-text field, a conditional follow-up,
 * and options that stay hidden on small screens unless already chosen.
 */
export function ChoiceGroup({
  groupLabel,
  options,
  selected,
  onToggle,
  otherValue,
  onOtherChange,
  otherPlaceholder,
  maxSelections,
  hiddenOnMobile,
  followUp,
}: {
  groupLabel: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  otherValue: string;
  onOtherChange: (value: string) => void;
  otherPlaceholder: string;
  maxSelections?: number;
  hiddenOnMobile?: readonly string[];
  followUp?: ChoiceFollowUp;
}) {
  const atLimit =
    maxSelections !== undefined && selected.length >= maxSelections;

  return (
    <div role="group" aria-label={groupLabel} style={{ maxWidth: 420 }}>
      <div style={{ display: "grid", gap: 6 }}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          // A restored answer must never vanish, so a chosen option stays
          // visible even when its peers are hidden on small screens.
          const mobileHidden = hiddenOnMobile?.includes(option) && !isSelected;

          return (
            <div
              key={option}
              className={mobileHidden ? "hidden sm:block" : undefined}
            >
              <ChoiceOption
                label={option}
                selected={isSelected}
                disabled={atLimit && !isSelected}
                onClick={() => onToggle(option)}
              />
              {followUp && followUp.showForValue === option && isSelected ? (
                <div
                  style={{
                    marginTop: 6,
                    padding: "8px 10px",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    background: "var(--subtle)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {followUp.label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 7,
                    }}
                  >
                    {followUp.options.map((followUpOption) => (
                      <Chip
                        key={followUpOption}
                        label={followUpOption}
                        selected={followUp.value === followUpOption}
                        onClick={() =>
                          followUp.onChange(
                            followUp.value === followUpOption
                              ? ""
                              : followUpOption,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {selected.includes("Other") ? (
        <TextInput
          value={otherValue}
          aria-label={otherPlaceholder}
          placeholder={otherPlaceholder}
          onChange={(event) => onOtherChange(event.target.value)}
          style={{ width: "100%", marginTop: 8 }}
        />
      ) : null}
    </div>
  );
}
