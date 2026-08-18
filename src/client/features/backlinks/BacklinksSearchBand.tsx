import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Icon } from "@/client/components/icons/IconSprite";
import { PrimaryButton } from "@/client/components/prominence/Primitives";
import {
  createFormValidationErrors,
  getFieldError,
  getFormError,
  shouldValidateFieldOnChange,
} from "@/client/lib/forms";
import { useFocusRing } from "./BacklinksDataTable";
import type { BacklinksSearchState } from "./backlinksPageTypes";
import {
  inferBacklinksSearchScopeFromTarget,
  resolveBacklinksSearchScope,
} from "./backlinksSearchScope";

type SearchDraft = Pick<BacklinksSearchState, "target" | "scope">;

function getBacklinksValidationErrors(
  value: SearchDraft,
  shouldValidateUntouchedField: boolean,
) {
  if (!value.target.trim()) {
    if (!shouldValidateUntouchedField) {
      return null;
    }

    return createFormValidationErrors({
      fields: {
        target: "Enter a domain or URL to analyze.",
      },
    });
  }

  return null;
}

function ScopeButton({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      {...focusProps}
      style={{
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${selected ? "var(--accent-border)" : "transparent"}`,
        background: selected ? "var(--accent-soft)" : "transparent",
        color: selected ? "var(--accent)" : "var(--text-2)",
        fontSize: 11.5,
        fontWeight: selected ? 600 : 400,
        fontFamily: "inherit",
        cursor: "pointer",
        ...focusStyle,
      }}
    >
      {label}
    </button>
  );
}

/**
 * The lookup bar. The design assumes a single site is already in view; this
 * screen answers for any target the user types, so the search stays, drawn as
 * a row inside the header band between the title and the tabs.
 */
export function BacklinksSearchBand({
  errorMessage,
  initialValues,
  onSubmit,
}: {
  errorMessage: string | null;
  initialValues: SearchDraft;
  onSubmit: (values: SearchDraft) => void;
}) {
  const [userSelectedScope, setUserSelectedScope] = useState(false);
  const { focusProps, focusStyle } = useFocusRing();
  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: ({ formApi, value }) =>
        getBacklinksValidationErrors(
          value,
          shouldValidateFieldOnChange(formApi, "target"),
        ),
      onSubmit: ({ value }) => getBacklinksValidationErrors(value, true),
    },
    onSubmit: ({ value }) => {
      const target = value.target.trim();
      const scope = resolveBacklinksSearchScope({
        target,
        selectedScope: value.scope,
        userSelectedScope,
      });

      onSubmit({ ...value, target, scope });
    },
  });

  useEffect(() => {
    form.reset(initialValues);
    setUserSelectedScope(false);
  }, [form, initialValues]);

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <form.Field name="target">
          {(field) => {
            const targetError = getFieldError(field.state.meta.errors);
            return (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flex: "1 1 260px",
                  minWidth: 0,
                  minHeight: 28,
                  padding: "3px 9px",
                  border: `1px solid ${targetError ? "var(--danger-border)" : "var(--line)"}`,
                  borderRadius: 6,
                  background: "var(--surface)",
                  ...focusStyle,
                }}
              >
                <Icon
                  name="i-search"
                  size={13}
                  style={{ color: "var(--text-3)" }}
                />
                <input
                  placeholder="Enter a domain or URL"
                  aria-label="Domain or URL to analyze"
                  value={field.state.value}
                  {...focusProps}
                  onChange={(event) => {
                    const nextTarget = event.target.value;
                    field.handleChange(nextTarget);
                    if (!userSelectedScope) {
                      form.setFieldValue(
                        "scope",
                        inferBacklinksSearchScopeFromTarget(nextTarget),
                      );
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    outline: "none",
                    background: "none",
                    color: "var(--text)",
                    fontSize: 12.5,
                    fontFamily: "inherit",
                  }}
                />
              </label>
            );
          }}
        </form.Field>

        <form.Field name="scope">
          {(field) => (
            <div
              role="group"
              aria-label="Lookup scope"
              style={{ display: "flex", gap: 4 }}
            >
              <ScopeButton
                selected={field.state.value === "domain"}
                label="Site-wide"
                onSelect={() => {
                  setUserSelectedScope(true);
                  field.handleChange("domain");
                }}
              />
              <ScopeButton
                selected={field.state.value === "page"}
                label="Exact page"
                onSelect={() => {
                  setUserSelectedScope(true);
                  field.handleChange("page");
                }}
              />
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Loading..." : "Search"}
            </PrimaryButton>
          )}
        </form.Subscribe>
      </form>

      <form.Field name="target">
        {(field) => {
          const targetError = getFieldError(field.state.meta.errors);
          return targetError ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "var(--danger)",
              }}
            >
              {targetError}
            </p>
          ) : null;
        }}
      </form.Field>

      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(submitError) => {
          const formError = getFormError(submitError);
          return formError ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "var(--danger)",
              }}
            >
              {formError}
            </p>
          ) : null;
        }}
      </form.Subscribe>

      {errorMessage ? (
        <p
          style={{ margin: "6px 0 0", fontSize: 12, color: "var(--danger)" }}
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
