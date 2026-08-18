import { useId, type ReactNode } from "react";
import { focusRing } from "@/client/features/domain/components/domainTableStyles";

/**
 * Filter fields, drawn to the design's Forms & validation recipe.
 *
 * Every value here is read off that page: label 12.5px/600 sitting directly on
 * the field, help text 12px in `--text-2` with 2px/6px margins, and a control
 * that is 32px tall with 10px side padding, a 6px radius and a `--line` border
 * on `--surface`. The one addition is the Min/Max sub-label: the design has no
 * range control, and two unlabelled boxes with placeholder text would leave a
 * screen reader announcing nothing but "edit text".
 */

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
};

/** Sub-label for the two halves of a range. Muted, the way the design mutes
 * its "Required" marker, so the group title stays the dominant word. */
const SUB_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 400,
  color: "var(--text-3)",
  marginBottom: 3,
};

const HELP: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-2)",
  margin: "2px 0 6px",
};

const FIELD: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 13,
  outline: "none",
};

/** The design's compact control, used inside a range group. */
const FIELD_COMPACT: React.CSSProperties = {
  ...FIELD,
  height: 28,
  padding: "0 8px",
  fontSize: 12.5,
};

export function FilterTextInput({
  label,
  help,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  /** Shown when the accepted format is not obvious from the label alone. */
  help?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;

  return (
    <div>
      <label htmlFor={id} style={LABEL}>
        {label}
      </label>
      {help ? (
        <div id={helpId} style={HELP}>
          {help}
        </div>
      ) : null}
      <input
        id={id}
        type="text"
        aria-describedby={help ? helpId : undefined}
        style={{ ...FIELD, ...(help ? null : { marginTop: 5 }) }}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...focusRing<HTMLInputElement>()}
      />
    </div>
  );
}

export function FilterNumberInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  id: string;
  /** Visible, bound name for this half of the range ("Min" or "Max"). */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  step?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <label htmlFor={id} style={SUB_LABEL}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        step={step}
        style={FIELD_COMPACT}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        {...focusRing<HTMLInputElement>()}
      />
    </div>
  );
}

/**
 * A titled pair of bounds. The title names the measure once and the group is
 * labelled by it, so a screen reader reads "Volume, Min" rather than "Min".
 */
export function FilterRangeGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      style={{
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--surface)",
        padding: "8px 10px",
        minWidth: 0,
      }}
    >
      <div id={titleId} style={{ ...LABEL, marginBottom: 6 }}>
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        {children}
      </div>
    </div>
  );
}
