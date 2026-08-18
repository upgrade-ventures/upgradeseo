import type { CSSProperties } from "react";
import { Card, PrimaryButton } from "@/client/components/prominence/Primitives";
import {
  CheckboxField,
  Field,
  TextInput,
} from "@/client/components/prominence/Field";
import { MIN_PAGES } from "@/client/features/audit/launch/types";
import type { useLaunchController } from "@/client/features/audit/launch/useLaunchController";
import { getFieldError, getFormError } from "@/client/lib/forms";

type Props = {
  launchForm: ReturnType<typeof useLaunchController>["launchForm"];
  commitMaxPagesInput: () => number;
  maxPagesLimit: number;
};

/**
 * The control that raises the confirm step. It is addressed by id so the
 * confirm can hand focus back to it when it is dismissed.
 */
export const SUBMIT_BUTTON_ID = "audit-launch-submit";

const OPTION_BOX: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--subtle)",
  padding: "10px 12px",
};

/**
 * The crawl form.
 *
 * Fields follow the design's anatomy: a visible label bound to the control, a
 * description above it saying why we are asking, and errors below it tied to
 * the input and announced when the field is left. The submit button does not
 * start the crawl — it opens the scope confirm.
 */
export function LaunchFormCard({
  commitMaxPagesInput,
  launchForm,
  maxPagesLimit,
}: Props) {
  return (
    <Card title="Start a crawl">
      <form
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void launchForm.handleSubmit();
        }}
      >
        <launchForm.Field name="url">
          {(field) => {
            const urlError = getFieldError(field.state.meta.errors);
            return (
              <Field
                label="Start URL"
                required
                description="The address we crawl out from. Every page we can reach from here, on the same site, is included."
                error={urlError}
                hint="Include the protocol, for example https://example.com."
              >
                {(control) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <TextInput
                      {...control}
                      placeholder="https://example.com"
                      value={field.state.value}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                        if (launchForm.state.errorMap.onSubmit) {
                          launchForm.setErrorMap({ onSubmit: undefined });
                        }
                      }}
                      onBlur={field.handleBlur}
                      style={{ flex: 1, minWidth: 220, width: "auto" }}
                    />
                    <launchForm.Subscribe
                      selector={(state) => state.isSubmitting}
                    >
                      {(isSubmitting) => (
                        <PrimaryButton
                          id={SUBMIT_BUTTON_ID}
                          type="submit"
                          disabled={isSubmitting}
                        >
                          Start crawl
                        </PrimaryButton>
                      )}
                    </launchForm.Subscribe>
                  </div>
                )}
              </Field>
            );
          }}
        </launchForm.Field>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 10,
          }}
        >
          <div style={OPTION_BOX}>
            <launchForm.Field name="maxPagesInput">
              {(field) => (
                <Field
                  label="Crawl limit"
                  description="The most pages we will fetch. The crawl stops there even if the site is larger."
                  hint={`Any value from ${MIN_PAGES} to ${maxPagesLimit.toLocaleString()}. Out-of-range entries are pulled back into it.`}
                >
                  {(control) => (
                    <TextInput
                      {...control}
                      type="number"
                      inputMode="numeric"
                      min={MIN_PAGES}
                      max={maxPagesLimit}
                      value={field.state.value}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (!/^\d*$/.test(next)) return;
                        field.handleChange(next);
                        if (launchForm.state.errorMap.onSubmit) {
                          launchForm.setErrorMap({ onSubmit: undefined });
                        }
                      }}
                      // Clamping on blur is what keeps an out-of-range entry
                      // from ever reaching submit.
                      onBlur={() => {
                        field.handleBlur();
                        commitMaxPagesInput();
                      }}
                      style={{ width: 130 }}
                    />
                  )}
                </Field>
              )}
            </launchForm.Field>
          </div>

          <div style={OPTION_BOX}>
            <launchForm.Field name="runLighthouse">
              {(field) => (
                <CheckboxField
                  checked={Boolean(field.state.value)}
                  onChange={(checked) => field.handleChange(checked)}
                  label="Include Lighthouse"
                  description="Scores come from Google PageSpeed Insights, on a sample of up to 20 pages chosen to skip duplicate templates. It adds several minutes to the run."
                />
              )}
            </launchForm.Field>
          </div>
        </div>

        <launchForm.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(submitError) => {
            const errorMessage = getFormError(submitError);
            return errorMessage ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--danger-soft)",
                  border: "1px solid var(--danger-border)",
                  fontSize: 12.5,
                  color: "var(--danger)",
                }}
              >
                {errorMessage}
              </p>
            ) : null;
          }}
        </launchForm.Subscribe>
      </form>
    </Card>
  );
}
