import {
  useId,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon } from "@/client/components/icons/IconSprite";

/**
 * The Forms & validation page, as components.
 *
 * The rules that page states are enforced by the shape of `Field` rather than
 * left to each caller's discipline:
 *
 *   Label always visible, and bound to the control. `Field` owns the id and
 *   hands it to the control through a render prop, so a field cannot be built
 *   with an unbound label.
 *   Description above the control, explaining why we are asking before the
 *   user types. Placeholders show format, never the name of the field.
 *   Errors below, tied to the input, with `aria-describedby` and
 *   `aria-invalid`, announced on blur rather than on every keystroke.
 *   Errors offer the fix: the message says what to do, not just what is wrong.
 *   Required is marked in words next to the label, not by a bare asterisk.
 */

/* ── Field ────────────────────────────────────────────────────────────────── */

type ControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  disabled: boolean | undefined;
};

export function Field({
  label,
  required = false,
  description,
  error,
  hint,
  counter,
  disabled,
  style,
  children,
}: {
  label: ReactNode;
  /** Required is marked in words, per the design's own field header. */
  required?: boolean;
  /** Why we are asking. Shown above the control. */
  description?: ReactNode;
  /** Set on blur, cleared as soon as the value is valid again. */
  error?: string | null;
  /** Standing note below the control, replaced by the error when there is one. */
  hint?: ReactNode;
  /** Right-hand tabular figure, e.g. "15 / 40" or "4 lines · 3 unique". */
  counter?: ReactNode;
  disabled?: boolean;
  style?: CSSProperties;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const muted = disabled ? "var(--text-3)" : undefined;

  return (
    <div style={style}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: 12.5,
          fontWeight: 600,
          color: muted,
        }}
      >
        {label}
        {required ? (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 400,
              color: "var(--text-3)",
            }}
          >
            Required
          </span>
        ) : null}
      </label>

      {description ? (
        <div
          id={descriptionId}
          style={{
            fontSize: 12,
            color: muted ?? "var(--text-2)",
            margin: "2px 0 6px",
          }}
        >
          {description}
        </div>
      ) : null}

      {children({
        id,
        "aria-describedby":
          [description ? descriptionId : null, error ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined,
        "aria-invalid": error ? true : undefined,
        disabled,
      })}

      {/* Always mounted so a message appearing on blur is an update to a live
          region rather than a new node the reader is never told about. */}
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

      {!error && (hint || counter) ? (
        <div
          style={{
            marginTop: 5,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            fontSize: 11.5,
            color: "var(--text-3)",
          }}
        >
          <span>{hint}</span>
          {counter ? (
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
              }}
            >
              {counter}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The design's inline "Available" / "Valid" confirmation, for a `hint`. */
export function FieldSuccess({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "var(--success)",
      }}
    >
      <Icon name="i-check" size={12} style={{ strokeWidth: 2 }} />
      {children}
    </span>
  );
}

/* ── Controls ─────────────────────────────────────────────────────────────── */

/**
 * The design draws no focus rule on fields, only a focused specimen carrying
 * `var(--focus)` plus an accent border. Screens may not add shared CSS, so the
 * ring is carried as component state.
 */
function useFocusRing() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    handlers: {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}

function controlStyle({
  invalid,
  disabled,
  focused,
}: {
  invalid: boolean;
  disabled: boolean;
  focused: boolean;
}): CSSProperties {
  if (disabled) {
    return {
      border: "1px solid var(--border-muted)",
      background: "var(--inset)",
      color: "var(--text-3)",
      cursor: "not-allowed",
    };
  }
  return {
    border: `1px solid ${
      invalid ? "var(--danger)" : focused ? "var(--accent)" : "var(--line)"
    }`,
    background: invalid ? "var(--danger-soft)" : "var(--surface)",
    color: "var(--text)",
    ...(focused ? { boxShadow: "var(--focus)" } : null),
  };
}

const CONTROL_BASE: CSSProperties = {
  width: "100%",
  minHeight: 30,
  padding: "5px 9px",
  borderRadius: 6,
  fontFamily: "inherit",
  fontSize: 13,
  outline: "none",
};

export function TextInput({
  style,
  onFocus,
  onBlur,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  const { focused, handlers } = useFocusRing();
  return (
    <input
      type="text"
      {...rest}
      onFocus={(event) => {
        handlers.onFocus();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        handlers.onBlur();
        onBlur?.(event);
      }}
      style={{
        ...CONTROL_BASE,
        ...controlStyle({
          invalid: rest["aria-invalid"] === true,
          disabled: Boolean(rest.disabled),
          focused,
        }),
        ...style,
      }}
    />
  );
}

export function TextArea({
  style,
  onFocus,
  onBlur,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { focused, handlers } = useFocusRing();
  return (
    <textarea
      {...rest}
      onFocus={(event) => {
        handlers.onFocus();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        handlers.onBlur();
        onBlur?.(event);
      }}
      style={{
        ...CONTROL_BASE,
        padding: "8px 10px",
        resize: "vertical",
        ...controlStyle({
          invalid: rest["aria-invalid"] === true,
          disabled: Boolean(rest.disabled),
          focused,
        }),
        ...style,
      }}
    />
  );
}

export function SelectInput({
  style,
  children,
  onFocus,
  onBlur,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const { focused, handlers } = useFocusRing();
  return (
    <select
      {...rest}
      onFocus={(event) => {
        handlers.onFocus();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        handlers.onBlur();
        onBlur?.(event);
      }}
      style={{
        ...CONTROL_BASE,
        padding: "5px 8px",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        ...controlStyle({
          invalid: rest["aria-invalid"] === true,
          disabled: Boolean(rest.disabled),
          focused,
        }),
        ...style,
      }}
    >
      {children}
    </select>
  );
}

/**
 * Checkbox with its own visible label and optional second line, from the
 * Choice controls block. A checkbox is its own label, so this does not go
 * through `Field`.
 */
export function CheckboxField({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 8,
        alignItems: description ? "flex-start" : "center",
        fontSize: 12.5,
        color: disabled ? "var(--text-3)" : undefined,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{
          accentColor: "var(--accent)",
          marginTop: description ? 2 : 0,
          cursor: "inherit",
        }}
      />
      <span>
        {label}
        {description ? (
          <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
            {description}
          </div>
        ) : null}
      </span>
    </label>
  );
}

/* ── Validation ───────────────────────────────────────────────────────────── */

/**
 * Inline validation on blur.
 *
 * The message appears when the field is first left, not while the user is
 * still typing into it, and clears the moment the value becomes valid. The
 * validator returns the sentence to show, which by the design's rule must name
 * the fix and not merely the fault.
 */
export function useBlurValidation<T>(
  value: T,
  validate: (value: T) => string | null,
) {
  const [blurred, setBlurred] = useState(false);
  const message = validate(value);

  return {
    /** The message to hand to `Field`, or null while it should stay quiet. */
    error: blurred ? message : null,
    /** True regardless of whether the field has been visited yet. */
    isValid: message === null,
    /** Spread onto the control. */
    fieldProps: { onBlur: () => setBlurred(true) },
    /** Force the message out, for a submit attempt on an untouched field. */
    reveal: () => setBlurred(true),
  };
}
