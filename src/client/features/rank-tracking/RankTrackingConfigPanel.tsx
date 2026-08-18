import { useMemo, useState } from "react";
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
import type { RankTrackingConfig } from "@/types/schemas/rank-tracking";
import { domainField, normalizeDomain } from "@/types/schemas/domain";
import { depthToPages, pagesToDepth } from "@/shared/rank-tracking";
import { getLanguageCode } from "@/client/features/keywords/locations";
import {
  SERP_LANGUAGE_OPTIONS,
  getIsoCountryCode,
} from "@/shared/keyword-locations";
import { LocationSelect } from "@/client/components/LocationSelect";
import type { ProjectMarket } from "@/client/features/projects/types";
import { useProjectMarket } from "@/client/features/projects/useProjectMarket";
import { SearchTargetingField } from "./SearchTargetingField";
import { KeywordSuggestionStep } from "./KeywordSuggestionStep";
import { useSaveConfigMutations } from "./useSaveConfigMutations";
import { Skeleton } from "./RankScreenParts";
import { PanelBand, PanelHeader } from "./RankPanelParts";

type Props = {
  projectId: string;
  existingConfig?: RankTrackingConfig | null;
  onClose: () => void;
  onSaved: (createdConfigId?: string) => void;
  onConfigCreated?: () => void;
};

/**
 * Add or edit a tracked domain.
 *
 * The design has no dialogs, so this is a band in the page under the screen
 * header rather than an overlay: the table it is about stays on screen, and
 * dismissing it is a plain button rather than a scrim click.
 */
export function RankTrackingConfigPanel({
  projectId,
  existingConfig,
  onClose,
  onSaved,
  onConfigCreated,
}: Props) {
  const projectMarket = useProjectMarket(projectId);

  // A new domain's defaults come from the project's market, so the form waits
  // for it rather than opening on values it is about to replace.
  if (!existingConfig && !projectMarket) {
    return (
      <PanelBand aria-busy>
        <PanelHeader title="Add domain" onClose={onClose} />
        <div
          style={{ display: "flex", flexDirection: "column", gap: 11 }}
          aria-label="Loading the tracking defaults for this project"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} width="100%" height={30} />
          ))}
        </div>
      </PanelBand>
    );
  }

  return (
    <RankTrackingConfigForm
      projectId={projectId}
      existingConfig={existingConfig}
      initialMarket={existingConfig ?? projectMarket!}
      onClose={onClose}
      onSaved={onSaved}
      onConfigCreated={onConfigCreated}
    />
  );
}

function RankTrackingConfigForm({
  projectId,
  existingConfig,
  initialMarket,
  onClose,
  onSaved,
  onConfigCreated,
}: Props & { initialMarket: ProjectMarket }) {
  const isEdit = !!existingConfig;
  const [step, setStep] = useState<"config" | "keywords">("config");
  const [domain, setDomain] = useState(existingConfig?.domain ?? "");
  const [devices, setDevices] = useState<"both" | "desktop" | "mobile">(
    existingConfig?.devices ?? "mobile",
  );
  const [locationCode, setLocationCode] = useState(
    existingConfig?.locationCode ?? initialMarket.locationCode,
  );
  const [languageCode, setLanguageCode] = useState(
    existingConfig?.languageCode ?? initialMarket.languageCode,
  );
  const [serpDepth, setSerpDepth] = useState(existingConfig?.serpDepth ?? 40);
  const [schedule, setSchedule] = useState<
    RankTrackingConfig["scheduleInterval"]
  >(existingConfig?.scheduleInterval ?? "weekly");
  const [targetingMode, setTargetingMode] = useState<"national" | "local">(
    existingConfig?.locationName ? "local" : "national",
  );
  const [locationName, setLocationName] = useState<string | undefined>(
    existingConfig?.locationName ?? undefined,
  );
  const [createdConfigId, setCreatedConfigId] = useState<string | null>(null);

  const selectedCountryCode = useMemo(
    () => getIsoCountryCode(locationCode),
    [locationCode],
  );

  const { createMutation, updateMutation } = useSaveConfigMutations({
    projectId,
    existingConfig,
    fields: {
      devices,
      serpDepth,
      locationCode,
      languageCode,
      targetingMode,
      locationName,
      schedule,
    },
    onCreated: (configId) => {
      setCreatedConfigId(configId);
      onConfigCreated?.();
      setStep("keywords");
    },
    onUpdated: () => onSaved(),
  });

  // Validation is inline and tied to the control, not a toast: a toast leaves
  // the reader to work out which field it was about, and it is gone before
  // they have fixed it. Each message names the fix.
  const domainValidation = useBlurValidation(domain, (value) => {
    if (!value.trim()) {
      return "Enter the site to track, for example example.com.";
    }
    return domainField.safeParse(value).success
      ? null
      : "That is not a domain we can track. Try example.com — no https://, no path, no spaces.";
  });
  const targetingError =
    targetingMode === "local" && !locationName
      ? "Pick the city or region to search from, or switch back to National."
      : null;
  const [targetingBlurred, setTargetingBlurred] = useState(false);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;

    domainValidation.reveal();
    setTargetingBlurred(true);
    if (!domainValidation.isValid || targetingError) return;

    const parsedDomain = domainField.safeParse(domain);
    if (!parsedDomain.success) return;

    setDomain(parsedDomain.data);
    if (isEdit) {
      updateMutation.mutate(parsedDomain.data);
    } else {
      createMutation.mutate(parsedDomain.data);
    }
  };

  const handleDomainBlur = () => {
    try {
      setDomain(normalizeDomain(domain));
    } catch {
      // Keep invalid partial input editable; the inline message says the fix.
    }
  };

  if (step === "keywords" && createdConfigId) {
    const closeKeywordStep = () => onSaved(createdConfigId);
    return (
      <PanelBand>
        <PanelHeader
          title={`Keywords for ${domain}`}
          step="Step 2 of 2"
          onClose={closeKeywordStep}
        />
        <KeywordSuggestionStep
          configId={createdConfigId}
          projectId={projectId}
          domain={domain}
          locationCode={locationCode}
          onDone={(id) => onSaved(id)}
          onClose={closeKeywordStep}
        />
      </PanelBand>
    );
  }

  return (
    <PanelBand>
      <PanelHeader
        title={isEdit ? `Tracking settings for ${domain}` : "Add domain"}
        step={isEdit ? undefined : "Step 1 of 2"}
        onClose={onClose}
      />
      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: 14,
          maxWidth: 860,
        }}
      >
        <Field
          label="Target domain"
          required
          description="The site whose positions we measure. No https:// and no path."
          error={domainValidation.error}
        >
          {(control) => (
            <TextInput
              {...control}
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onBlur={() => {
                handleDomainBlur();
                domainValidation.fieldProps.onBlur();
              }}
            />
          )}
        </Field>

        <Field
          label="Country"
          required
          description="Where Google is queried from."
        >
          {(control) => (
            <LocationSelect
              id={control.id}
              value={locationCode}
              onChange={(newLocationCode) => {
                setLocationCode(newLocationCode);
                setLanguageCode(getLanguageCode(newLocationCode));
                // A picked city belongs to the previous country.
                setLocationName(undefined);
              }}
            />
          )}
        </Field>

        <SearchTargetingField
          mode={targetingMode}
          onModeChange={(next) => {
            setTargetingMode(next);
            setTargetingBlurred(true);
          }}
          locationName={locationName}
          onLocationNameChange={setLocationName}
          countryCode={selectedCountryCode}
          error={targetingBlurred ? targetingError : null}
        />

        <Field
          label="Language"
          description="Defaults to the country's language. Any language can be tracked in any country — pick the one your customers search in."
        >
          {(control) => (
            <SelectInput
              {...control}
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
            >
              {SERP_LANGUAGE_OPTIONS.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field
          label="Devices"
          description="Most Google searches come from mobile, but pick this on your own customers."
          hint={
            devices === "both"
              ? "Both devices means two checks per keyword, so a run takes twice as long."
              : undefined
          }
        >
          {(control) => (
            <SelectInput
              {...control}
              value={devices}
              onChange={(e) => {
                const value = e.target.value;
                if (
                  value === "both" ||
                  value === "desktop" ||
                  value === "mobile"
                ) {
                  setDevices(value);
                }
              }}
            >
              <option value="both">Desktop + Mobile</option>
              <option value="desktop">Desktop only</option>
              <option value="mobile">Mobile only</option>
            </SelectInput>
          )}
        </Field>

        <Field
          label="Check frequency"
          description="You can still check by hand at any time."
          hint={
            schedule === "daily"
              ? "Daily checks make seven times as many requests as weekly."
              : undefined
          }
        >
          {(control) => (
            <SelectInput
              {...control}
              value={schedule}
              onChange={(e) => {
                const value = e.target.value;
                if (
                  value === "daily" ||
                  value === "weekly" ||
                  value === "monthly" ||
                  value === "manual"
                ) {
                  setSchedule(value);
                }
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly (end of month)</option>
              <option value="manual">Manual only</option>
            </SelectInput>
          )}
        </Field>

        <Field
          label="Search depth"
          description="How far down the results we look before calling a keyword unranked."
          hint="Ten pages takes roughly eight times as long to check as one."
        >
          {(control) => (
            <SelectInput
              {...control}
              value={depthToPages(serpDepth)}
              onChange={(e) =>
                setSerpDepth(pagesToDepth(Number(e.target.value)))
              }
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((pages) => (
                <option key={pages} value={pages}>
                  {pages} {pages === 1 ? "page" : "pages"} (top {pages * 10}{" "}
                  results)
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            type="submit"
            disabled={isPending}
            style={isPending ? { cursor: "progress" } : undefined}
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Add domain"}
          </PrimaryButton>
        </div>
      </form>
    </PanelBand>
  );
}
