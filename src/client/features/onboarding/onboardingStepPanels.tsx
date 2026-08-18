import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ErrorLine,
  FieldHint,
  FieldLabel,
  MiniButton,
  Skeleton,
  TextInput,
} from "@/client/features/onboarding/onboardingControls";
import { ProjectMarketFields } from "@/client/features/projects/ProjectMarketFields";
import type { ProjectMarket } from "@/client/features/projects/types";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { setProjectMarket } from "@/serverFunctions/projects";
import { withBasePath } from "@/shared/base-path";

type ProjectMarketRecord = {
  id: string;
  locationCode: number;
  languageCode: string;
};

/**
 * The band at the top of the screen: what is being set up, and how far through
 * it the user is. The counter is live so a screen reader hears the progress
 * change when a step resolves.
 */
export function ChecklistHeader({
  heading,
  subtitle,
  doneCount,
  stepCount,
}: {
  heading: string;
  subtitle: string;
  doneCount: number;
  stepCount: number;
}) {
  return (
    <div
      style={{
        padding: "18px var(--pad, 24px) 14px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <img
        src={withBasePath("/favicon.svg")}
        alt="UpgradeSEO"
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          marginBottom: 9,
          display: "block",
        }}
      />
      <h1
        style={{
          margin: 0,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        {heading}
      </h1>
      <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--text-2)" }}>
        {subtitle}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 11,
          maxWidth: 420,
        }}
      >
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={stepCount}
          aria-valuenow={doneCount}
          aria-label="Setup progress"
          style={{
            flex: 1,
            height: 5,
            borderRadius: 999,
            background: "var(--inset)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(doneCount / stepCount) * 100}%`,
              height: "100%",
              background: "var(--success)",
            }}
          />
        </div>
        <span
          aria-live="polite"
          style={{
            fontSize: 12,
            color: "var(--text-2)",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {doneCount} of {stepCount} done
        </span>
      </div>
    </div>
  );
}

/**
 * The site step's controls: the domain the whole product runs against, plus
 * the market its keyword, SERP and domain calls default to.
 */
export function SiteStepForm({
  hasDomain,
  value,
  onChange,
  onSave,
  onCancel,
  onSkip,
  saving,
  error,
  project,
}: {
  hasDomain: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onSkip: () => void;
  saving: boolean;
  error: string | null;
  project: ProjectMarketRecord;
}) {
  return (
    <div style={{ maxWidth: 460 }}>
      <form
        style={{ maxWidth: 320 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSave();
        }}
      >
        <FieldLabel htmlFor="onboarding-domain">Domain</FieldLabel>
        <FieldHint>
          {hasDomain
            ? "Changing this starts a fresh crawl and rank history."
            : "The bare host, like acme.com."}
        </FieldHint>
        <div style={{ display: "flex", gap: 6 }}>
          <TextInput
            id="onboarding-domain"
            value={value}
            placeholder="acme.com"
            autoComplete="url"
            disabled={saving}
            onChange={(event) => onChange(event.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          <MiniButton
            type="submit"
            tone="primary"
            disabled={saving || !value.trim()}
          >
            {saving ? "Saving" : "Save"}
          </MiniButton>
          {hasDomain ? (
            <MiniButton onClick={onCancel} disabled={saving}>
              Cancel
            </MiniButton>
          ) : (
            <MiniButton onClick={onSkip} disabled={saving}>
              Skip for now
            </MiniButton>
          )}
        </div>
        {error ? <ErrorLine>{error}</ErrorLine> : null}
      </form>

      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid var(--border-muted)",
        }}
      >
        <FieldLabel>Country and language</FieldLabel>
        <FieldHint>
          Keyword, SERP and domain data uses this market unless a search picks
          another one.
        </FieldHint>
        <DefaultMarketPicker project={project} />
      </div>
    </div>
  );
}

/**
 * Sets the project's default market during onboarding, so keyword, SERP, and
 * domain data lands on the user's market from their first search instead of
 * defaulting to the US. Saves on change: the buttons beside it belong to the
 * domain field, so a separate Save here would be easy to walk past.
 */
function DefaultMarketPicker({ project }: { project: ProjectMarketRecord }) {
  const queryClient = useQueryClient();
  const [market, setMarket] = useState<ProjectMarket>({
    locationCode: project.locationCode,
    languageCode: project.languageCode,
  });

  const saveMutation = useMutation({
    mutationFn: (next: ProjectMarket) =>
      setProjectMarket({ data: { projectId: project.id, ...next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <ProjectMarketFields
      value={market}
      onChange={(next) => {
        setMarket(next);
        saveMutation.mutate(next);
      }}
      hideLanguageOnMobile
    />
  );
}

/** The right-hand column: what the product costs, where help is, and an exit. */
export function OnboardingAside({
  complete,
  canLeave,
  onResearchKeywords,
  onReset,
}: {
  complete: boolean;
  canLeave: boolean;
  onResearchKeywords: () => void;
  onReset: () => void;
}) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>What this costs</div>
        <p style={ASIDE_BODY}>
          UpgradeSEO runs on free data sources out of the box. Add your own
          provider keys in Settings if you want higher limits. The keys and the
          data stay in your accounts.
        </p>
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--border-muted)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          If you get stuck
        </div>
        <p style={ASIDE_BODY}>
          The free setup guide under Help covers every free source end to end,
          and email is the fastest way to reach a human.
        </p>
        <div
          style={{
            display: "flex",
            gap: 7,
            marginTop: 9,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="mailto:support@upgrade.ventures"
            style={{ fontSize: 12.5, color: "var(--accent)" }}
          >
            support@upgrade.ventures
          </a>
          <span style={{ color: "var(--text-3)" }}>·</span>
          {/* This used to be a mailto: built from an empty address, which
              rendered as an invisible link that opened nothing. The in-app
              page is a destination that actually exists. */}
          <a href="/support" style={{ fontSize: 12.5, color: "var(--accent)" }}>
            Help &amp; Community
          </a>
        </div>
      </div>

      {complete ? null : (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: 14,
            background: "var(--subtle)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            You can use UpgradeSEO now
          </div>
          <p style={{ ...ASIDE_BODY, margin: "6px 0 9px" }}>
            Keyword research, domain lookups and site audits work without any
            connection. The steps above only add your own data.
          </p>
          <MiniButton
            style={{
              color: "var(--text)",
              padding: "4px 11px",
              fontSize: 12.5,
            }}
            disabled={!canLeave}
            onClick={onResearchKeywords}
          >
            Research a keyword instead
          </MiniButton>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 11.5,
              color: "var(--text-3)",
            }}
          >
            That closes this walkthrough. Whatever you skipped stays on your
            dashboard checklist.
          </p>
        </div>
      )}

      <MiniButton
        size="sm"
        tone="quiet"
        style={{ alignSelf: "flex-start" }}
        title="Reopens every step so you can review or change it. Nothing you have saved is deleted."
        onClick={onReset}
      >
        Reset this walkthrough
      </MiniButton>
    </aside>
  );
}

const ASIDE_BODY = {
  margin: "6px 0 0",
  fontSize: 12.5,
  color: "var(--text-2)",
} as const;

/** Placeholder rows while the project this checklist reports on loads. */
export function StepsCardSkeleton({ rows }: { rows: number }) {
  return (
    <div
      aria-hidden
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            gap: 11,
            alignItems: "stretch",
            padding: "12px 13px",
            borderBottom: "1px solid var(--border-muted)",
          }}
        >
          <Skeleton width={19} height={19} style={{ borderRadius: 999 }} />
          <div style={{ flex: 1, display: "grid", gap: 6 }}>
            <Skeleton width={160} height={12} />
            <Skeleton width="70%" />
          </div>
        </div>
      ))}
    </div>
  );
}
