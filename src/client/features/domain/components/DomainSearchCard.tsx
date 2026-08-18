import type { FormEvent } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import { PrimaryButton } from "@/client/components/prominence/Primitives";
import { LocationSelect } from "@/client/components/LocationSelect";
import { focusRing } from "@/client/features/domain/components/domainTableStyles";
import { getFieldError, getFormError } from "@/client/lib/forms";
import type { DomainOverviewControlsForm } from "@/client/features/domain/DomainOverviewPage";
import { LABS_LOCATION_OPTIONS } from "@/client/features/keywords/locations";

type Props = {
  controlsForm: DomainOverviewControlsForm;
  isLoading: boolean;
  onSubmit: (event: FormEvent) => void;
  onLocationChange: (locationCode: number) => void;
};

/**
 * The lookup controls, sitting inside the header band above the tab strip.
 *
 * The design's header names a fixed domain because its markup is static. Here
 * the domain is whatever the user asks for, so the control that chooses it
 * belongs with the identity it sets rather than in a card of its own.
 *
 * Sorting is not repeated here: every sortable column carries its own header
 * control, so a second sort picker would be two ways to write the same URL.
 */
export function DomainSearchCard({
  controlsForm,
  isLoading,
  onSubmit,
  onLocationChange,
}: Props) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <controlsForm.Field name="domain">
          {(field) => {
            const domainError = getFieldError(field.state.meta.errors);
            return (
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 0,
                  flex: "1 1 220px",
                  maxWidth: 340,
                  minHeight: 28,
                  padding: "0 9px",
                  border: `1px solid ${domainError ? "var(--danger-border)" : "var(--line)"}`,
                  background: "var(--surface)",
                  borderRadius: 6,
                }}
              >
                <span style={{ color: "var(--text-3)", display: "flex" }}>
                  <Icon name="i-search" size={13} />
                </span>
                <input
                  placeholder="Enter a domain"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-label="Domain to look up"
                  aria-invalid={domainError ? true : undefined}
                  aria-describedby={
                    domainError ? "domain-input-error" : undefined
                  }
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    outline: "none",
                    background: "none",
                    color: "var(--text)",
                    fontSize: 12.5,
                    fontFamily: "inherit",
                    padding: "4px 0",
                  }}
                />
              </label>
            );
          }}
        </controlsForm.Field>

        <controlsForm.Field name="locationCode">
          {(field) => (
            <LocationSelect
              value={field.state.value}
              options={LABS_LOCATION_OPTIONS}
              className="w-44 shrink-0"
              onChange={(code) => {
                field.handleChange(code);
                onLocationChange(code);
              }}
            />
          )}
        </controlsForm.Field>

        <controlsForm.Field name="subdomains">
          {(field) => (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: "var(--text-2)",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(event) => field.handleChange(event.target.checked)}
                style={{
                  width: 13,
                  height: 13,
                  margin: 0,
                  accentColor: "var(--accent)",
                  outline: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
                {...focusRing<HTMLInputElement>()}
              />
              Include subdomains
            </label>
          )}
        </controlsForm.Field>

        <controlsForm.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <PrimaryButton type="submit" disabled={isLoading || isSubmitting}>
              {isLoading || isSubmitting ? "Looking up..." : "Look up"}
            </PrimaryButton>
          )}
        </controlsForm.Subscribe>
      </div>

      <controlsForm.Field name="domain">
        {(field) => {
          const domainError = getFieldError(field.state.meta.errors);
          return domainError ? (
            <p
              id="domain-input-error"
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "var(--danger)",
              }}
            >
              {domainError}
            </p>
          ) : null;
        }}
      </controlsForm.Field>

      <controlsForm.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(submitError) => {
          const errorMessage = getFormError(submitError);
          return errorMessage ? (
            <p
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
                margin: "6px 0 0",
                fontSize: 12,
                color: "var(--danger)",
              }}
            >
              <Icon name="i-alert" size={13} style={{ marginTop: 1 }} />
              <span>{errorMessage}</span>
            </p>
          ) : null;
        }}
      </controlsForm.Subscribe>
    </form>
  );
}
