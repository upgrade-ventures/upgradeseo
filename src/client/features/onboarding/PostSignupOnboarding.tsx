import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import { PrimaryButton } from "@/client/components/prominence/Primitives";
import { useShellBreakpoint } from "@/client/layout/useShellBreakpoint";
import {
  ErrorLine,
  MiniButton,
} from "@/client/features/onboarding/onboardingControls";
import {
  OnboardingStepRow,
  type StepStatus,
} from "@/client/features/onboarding/OnboardingStepRow";
import type { OnboardingAnswers } from "@/client/features/onboarding/onboardingModel";
import {
  QuestionSteps,
  type QuestionKey,
} from "@/client/features/onboarding/onboardingQuestionSteps";
import {
  ChecklistHeader,
  OnboardingAside,
  SiteStepForm,
  StepsCardSkeleton,
} from "@/client/features/onboarding/onboardingStepPanels";
import { SearchConsoleOnboardingStep } from "@/client/features/onboarding/SearchConsoleOnboardingStep";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { getGscConnection } from "@/serverFunctions/gsc";
import { getProjects, setProjectDomain } from "@/serverFunctions/projects";

type StepKey = "site" | QuestionKey | "gsc";

const STEP_ORDER: StepKey[] = ["site", "focus", "context", "source", "gsc"];

/**
 * Where each step's answers sit in the persisted payload. `buildOnboardingPayload`
 * writes every field up to the index it is given, so the checklist has to pass
 * the index of the step being saved rather than its position in the list (the
 * site step is a project record, not an answer).
 */
const ANSWER_STEP_INDEX: Record<Exclude<StepKey, "site">, number> = {
  focus: 0,
  context: 1,
  source: 2,
  gsc: 3,
};

/**
 * Skipping is a decision about this walkthrough, not user data, so it lives in
 * the session rather than the database. It has to survive one navigation
 * though: connecting Search Console leaves the app for Google's consent screen
 * and comes back to a fresh page.
 */
const SKIPPED_STORAGE_KEY = "upgradeseo:onboarding-skipped";

function readSkippedSteps(): Set<StepKey> {
  try {
    const raw = sessionStorage.getItem(SKIPPED_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    const values: unknown[] = parsed;
    return new Set(
      values.filter((value): value is StepKey =>
        STEP_ORDER.some((key) => key === value),
      ),
    );
  } catch {
    return new Set();
  }
}

function writeSkippedSteps(steps: Set<StepKey>) {
  try {
    sessionStorage.setItem(SKIPPED_STORAGE_KEY, JSON.stringify([...steps]));
  } catch {
    // A blocked session store only costs the user a re-skip; never fail the UI.
  }
}

type PostSignupOnboardingProps = {
  firstName: string;
  title?: string;
  helperText?: string;
  answers: OnboardingAnswers;
  onAnswersChange: (answers: OnboardingAnswers) => void;
  /** Persist the answers collected up to this step. */
  onCommit: (stepIndex: number) => void;
  onSkip: (stepIndex: number) => void;
  onFinish: () => void;
  onResearchKeywords: (projectId: string) => void;
  isSaving: boolean;
  accountMenu: ReactNode;
};

/**
 * The get-started checklist.
 *
 * Every row states real state: the site row reads the project record, the
 * Search Console row reads the live connection, and the three question rows
 * read the answers already saved for this user. Nothing is marked done that
 * was not actually done.
 */
export function PostSignupOnboarding({
  firstName,
  title,
  helperText,
  answers,
  onAnswersChange,
  onCommit,
  onSkip,
  onFinish,
  onResearchKeywords,
  isSaving,
  accountMenu,
}: PostSignupOnboardingProps) {
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  // This screen renders outside the app shell, so it has to set the design's
  // page gutter itself: 24px, tightening to 14px under the narrow breakpoint.
  const { narrow } = useShellBreakpoint(rootRef);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });
  const project = projectsQuery.data?.[0];
  const gscQuery = useQuery({
    queryKey: ["gscConnection", project?.id],
    queryFn: () => getGscConnection({ data: { projectId: project?.id ?? "" } }),
    enabled: Boolean(project?.id),
  });

  // Seeded from the answers already on the account, so a returning user sees
  // their finished steps as finished. Session state from there on: a step is
  // done once its answer has actually been written.
  const [committed, setCommitted] = useState<Set<StepKey>>(() => {
    const seed = new Set<StepKey>();
    if (answers.selectedInterests.length > 0) seed.add("focus");
    if (answers.workFor) seed.add("context");
    if (answers.source) seed.add("source");
    return seed;
  });
  const [skipped, setSkipped] = useState<Set<StepKey>>(readSkippedSteps);
  const [editingSite, setEditingSite] = useState(false);
  const [domainInput, setDomainInput] = useState("");

  const domainMutation = useMutation({
    mutationFn: (domain: string) =>
      setProjectDomain({ data: { projectId: project?.id ?? "", domain } }),
    onSuccess: () => {
      setEditingSite(false);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const domain = project?.domain ?? null;
  const gscConnection = gscQuery.data;

  const isDone = (key: StepKey) => {
    if (key === "site") return Boolean(domain) && !editingSite;
    if (key === "gsc") return gscConnection?.connected === true;
    return committed.has(key);
  };
  // Exactly one step is expanded at a time: the first that is neither done nor
  // skipped. Reopening an earlier step therefore collapses a later one.
  const activeKey =
    STEP_ORDER.find((key) => !isDone(key) && !skipped.has(key)) ?? null;
  const statusOf = (key: StepKey): StepStatus => {
    if (isDone(key)) return "done";
    if (skipped.has(key)) return "skipped";
    return activeKey === key ? "active" : "todo";
  };
  const doneCount = STEP_ORDER.filter(isDone).length;
  const complete = activeKey === null;

  const update = (patch: Partial<OnboardingAnswers>) =>
    onAnswersChange({ ...answers, ...patch });

  const commit = (key: Exclude<StepKey, "site">) => {
    setCommitted((current) => new Set(current).add(key));
    onCommit(ANSWER_STEP_INDEX[key]);
  };
  const changeSkipped = (mutate: (steps: Set<StepKey>) => void) =>
    setSkipped((current) => {
      const next = new Set(current);
      mutate(next);
      writeSkippedSteps(next);
      return next;
    });
  const skip = (key: StepKey) => {
    changeSkipped((steps) => steps.add(key));
    if (key === "site") {
      setEditingSite(false);
      return;
    }
    onSkip(ANSWER_STEP_INDEX[key]);
  };
  const startEditingSite = () => {
    setDomainInput(domain ?? "");
    setEditingSite(true);
  };
  const resume = (key: StepKey) => {
    changeSkipped((steps) => steps.delete(key));
    // The site row has nothing to reopen but its form: without a domain there
    // is no value line for it to fall back to.
    if (key === "site" && !domain) startEditingSite();
  };
  const reopen = (key: Exclude<StepKey, "site" | "gsc">) =>
    setCommitted((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  // Reopens every step for review. Nothing saved is deleted: the answers stay
  // in state and in the database, they just become editable again.
  const resetWalkthrough = () => {
    changeSkipped((steps) => steps.clear());
    setCommitted(new Set());
    setDomainInput(domain ?? "");
    setEditingSite(Boolean(domain));
  };

  const heading =
    title ?? (domain ? `Get ${domain} set up` : "Get UpgradeSEO set up");
  const subtitle =
    helperText ??
    `${firstName ? `Welcome, ${firstName}. ` : ""}${STEP_ORDER.length} steps. Each one turns on a part of the product, and you can stop after any of them.`;

  return (
    <div
      ref={rootRef}
      style={
        {
          width: "100%",
          maxWidth: 1100,
          margin: "0 auto",
          ["--pad" as string]: narrow ? "14px" : "24px",
        } as CSSProperties
      }
    >
      {accountMenu}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 10,
          background: "var(--surface)",
          overflow: "hidden",
          paddingBottom: 48,
        }}
      >
        <ChecklistHeader
          heading={heading}
          subtitle={subtitle}
          doneCount={doneCount}
          stepCount={STEP_ORDER.length}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: 24,
            maxWidth: 1040,
            padding: "20px var(--pad, 24px)",
            alignItems: "start",
          }}
        >
          {projectsQuery.isLoading ? (
            <StepsCardSkeleton rows={STEP_ORDER.length} />
          ) : projectsQuery.isError || !project ? (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <ErrorLine onRetry={() => void projectsQuery.refetch()}>
                {projectsQuery.isError
                  ? getStandardErrorMessage(
                      projectsQuery.error,
                      "Could not load your project.",
                    )
                  : "No project on this account yet, so there is nothing to set up."}
              </ErrorLine>
            </div>
          ) : (
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                border: "1px solid var(--line)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <OnboardingStepRow
                number={1}
                tinted
                title="Your site"
                status={statusOf("site")}
                description="We crawl this domain, track how it ranks, and measure competitors against it."
                doneLine={
                  domain
                    ? `${domain} · every report and crawl runs against this.`
                    : null
                }
                skippedLine="Skipped. You can add a domain any time in project settings."
                onResume={() => resume("site")}
                trailing={
                  statusOf("site") === "done" ? (
                    <MiniButton
                      size="sm"
                      style={{ fontSize: 12 }}
                      onClick={startEditingSite}
                    >
                      Change
                    </MiniButton>
                  ) : null
                }
              >
                <SiteStepForm
                  hasDomain={Boolean(domain)}
                  value={domainInput}
                  onChange={setDomainInput}
                  onSave={() => domainMutation.mutate(domainInput.trim())}
                  onCancel={() => {
                    domainMutation.reset();
                    setEditingSite(false);
                  }}
                  onSkip={() => skip("site")}
                  saving={domainMutation.isPending}
                  error={
                    domainMutation.isError
                      ? getStandardErrorMessage(
                          domainMutation.error,
                          "Could not save the domain.",
                        )
                      : null
                  }
                  project={project}
                />
              </OnboardingStepRow>

              <QuestionSteps
                answers={answers}
                onAnswersChange={update}
                statusOf={statusOf}
                onResume={resume}
                onReopen={reopen}
                onCommit={commit}
                onSkip={skip}
                busy={isSaving}
              />

              <OnboardingStepRow
                number={5}
                title="Connect Search Console"
                status={statusOf("gsc")}
                description="Your real queries, clicks and impressions, straight from Google. This is what makes Search Performance and most of the dashboard work."
                doneLine={gscDoneLine(gscConnection)}
                skippedLine="Skipped. You can connect it any time from project settings."
                onResume={() => resume("gsc")}
              >
                <SearchConsoleOnboardingStep
                  projectId={project.id}
                  skipAction={
                    <MiniButton
                      style={{ fontSize: 12.5, padding: "4px 10px" }}
                      onClick={() => skip("gsc")}
                      disabled={isSaving}
                    >
                      Skip for now
                    </MiniButton>
                  }
                />
              </OnboardingStepRow>

              {complete ? (
                <li
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    padding: "12px 13px",
                    background: "var(--success-soft)",
                    borderTop: "1px solid var(--success-border)",
                  }}
                >
                  <Icon
                    name="i-check"
                    size={15}
                    style={{ color: "var(--success)", strokeWidth: 2 }}
                  />
                  <div style={{ flex: 1, fontSize: 12.5 }}>
                    <div style={{ fontWeight: 600 }}>Setup finished</div>
                    <div style={{ color: "var(--text-2)" }}>
                      Everything you turned on is running. Skipped steps stay on
                      your dashboard checklist.
                    </div>
                  </div>
                  <PrimaryButton onClick={onFinish} disabled={isSaving}>
                    {isSaving ? "Finishing" : "Go to dashboard"}
                  </PrimaryButton>
                </li>
              ) : null}
            </ol>
          )}

          <OnboardingAside
            complete={complete}
            canLeave={Boolean(project) && !isSaving}
            onResearchKeywords={() => project && onResearchKeywords(project.id)}
            onReset={resetWalkthrough}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Names the property and the Google account it came through. Both are read
 * back from the stored connection, so neither is assumed: an older connection
 * saved without an account email says less rather than something invented.
 */
function gscDoneLine(
  connection:
    | { siteUrl: string | null; connectedByEmail: string | null }
    | undefined,
): string {
  if (!connection?.siteUrl) return "Connected.";
  return connection.connectedByEmail
    ? `Connected as ${connection.connectedByEmail} · ${connection.siteUrl}`
    : `Connected to ${connection.siteUrl}`;
}
