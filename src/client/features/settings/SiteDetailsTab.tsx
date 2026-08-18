import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  Field,
  SelectInput,
  TextInput,
  useBlurValidation,
} from "@/client/components/prominence/Field";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import type { ProjectSummary } from "@/client/features/projects/types";
import { QuietNote } from "@/client/features/settings/settingsParts";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { updateProject } from "@/serverFunctions/projects";
import {
  getLanguageCode,
  getLanguageOptions,
  LOCATION_OPTIONS,
} from "@/shared/keyword-locations";

export function DetailsTab({
  site,
  onClose,
}: {
  site: ProjectSummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(site.name);
  const [domain, setDomain] = useState(site.domain ?? "");
  const [editingDomain, setEditingDomain] = useState(false);
  const [locationCode, setLocationCode] = useState(site.locationCode);
  const [languageCode, setLanguageCode] = useState(site.languageCode);

  // Validation runs on blur and names the fix, per the Forms & validation page.
  const nameField = useBlurValidation(name, (value) =>
    value.trim()
      ? null
      : "Give the site a display name so you can tell it apart in the switcher.",
  );
  const domainField = useBlurValidation(domain, (value) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) {
      return "Drop the https:// and enter the bare domain, such as example.com.";
    }
    if (/\s/.test(trimmed) || !/^[^\s/]+\.[^\s/]{2,}$/.test(trimmed)) {
      return "Enter a domain with its extension, such as example.com.";
    }
    return null;
  });

  const languageOptions = getLanguageOptions(locationCode);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateProject({
        data: {
          projectId: site.id,
          name: name.trim(),
          domain: domain.trim() || undefined,
          locationCode,
          languageCode,
        },
      }),
    onSuccess: async (saved) => {
      setEditingDomain(false);
      // Adopt what the server stored: it canonicalises the domain (lowercase,
      // no www), so echoing the typed text would leave the form looking dirty
      // for ever.
      setName(saved.name);
      setDomain(saved.domain ?? "");
      setLocationCode(saved.locationCode);
      setLanguageCode(saved.languageCode);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Site settings saved");
    },
  });

  const dirty =
    name.trim() !== site.name ||
    domain.trim() !== (site.domain ?? "") ||
    locationCode !== site.locationCode ||
    languageCode !== site.languageCode;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (updateMutation.isPending || !dirty) return;
        // Say what is wrong instead of failing silently on a field the user
        // may never have visited.
        if (!nameField.isValid || !domainField.isValid) {
          nameField.reveal();
          domainField.reveal();
          return;
        }
        updateMutation.mutate();
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 14,
        }}
      >
        <Field
          label="Display name"
          required
          description="Shown in the site switcher and in exports."
          error={nameField.error}
        >
          {(props) => (
            <TextInput
              {...props}
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              {...nameField.fieldProps}
            />
          )}
        </Field>

        <Field
          label="Domain"
          description="Audits, backlinks and rank checks all run against this domain."
          error={editingDomain ? domainField.error : null}
          hint={
            editingDomain
              ? "Data already collected stays on this site and still refers to the old domain."
              : undefined
          }
        >
          {(props) => (
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput
                {...props}
                value={domain}
                placeholder={editingDomain ? "example.com" : undefined}
                readOnly={!editingDomain}
                maxLength={255}
                onChange={(event) => setDomain(event.target.value)}
                {...domainField.fieldProps}
                style={{
                  flex: 1,
                  minWidth: 0,
                  // Read-only is not disabled: the value must stay selectable
                  // and readable, it simply is not editable until Change.
                  ...(editingDomain
                    ? null
                    : {
                        background: "var(--subtle)",
                        color: "var(--text-2)",
                        border: "1px solid var(--border-muted)",
                      }),
                }}
              />
              {editingDomain ? null : (
                <SecondaryButton
                  onClick={() => setEditingDomain(true)}
                  style={{ minHeight: 30, padding: "5px 9px", fontSize: 12 }}
                >
                  Change
                </SecondaryButton>
              )}
            </div>
          )}
        </Field>

        <Field
          label="Default location"
          description="Used for new keyword and rank lookups on this site."
        >
          {(props) => (
            <SelectInput
              {...props}
              value={locationCode}
              onChange={(event) => {
                const next = Number(event.target.value);
                setLocationCode(next);
                // A country's languages are a fixed set; keep the pair valid by
                // snapping to the native language, as the project form does.
                setLanguageCode(getLanguageCode(next));
              }}
            >
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field
          label="Default language"
          description={
            languageOptions.length > 1
              ? "This country serves more than one language."
              : "The language this country is served in."
          }
          disabled={languageOptions.length <= 1}
        >
          {(props) => (
            <SelectInput
              {...props}
              value={languageCode}
              onChange={(event) => setLanguageCode(event.target.value)}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      </div>

      <QuietNote>
        Crawls run when you start an audit. There is no crawl schedule to set
        yet, so nothing here runs on its own.
      </QuietNote>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--border-muted)",
          flexWrap: "wrap",
        }}
      >
        {/* Only "nothing to save" disables this. A value the form rejects
            leaves the button live so pressing it produces the reason. */}
        <PrimaryButton
          type="submit"
          disabled={!dirty || updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving…" : "Save changes"}
        </PrimaryButton>
        <SecondaryButton onClick={onClose} style={{ color: "var(--text-2)" }}>
          Cancel
        </SecondaryButton>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          {dirty ? "Unsaved changes" : "No unsaved changes"}
        </span>
      </div>

      {updateMutation.isError ? (
        <QuietNote tone="danger">
          {getStandardErrorMessage(
            updateMutation.error,
            "We could not save this site.",
          )}
        </QuietNote>
      ) : null}
    </form>
  );
}
