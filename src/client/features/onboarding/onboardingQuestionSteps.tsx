import type { ReactNode } from "react";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { ChoiceGroup } from "@/client/features/onboarding/onboardingChoiceGroup";
import { MiniButton } from "@/client/features/onboarding/onboardingControls";
import {
  OnboardingStepRow,
  type StepStatus,
} from "@/client/features/onboarding/OnboardingStepRow";
import {
  CLIENT_WEBSITE_COUNT_OPTIONS,
  CLIENT_WORK_FOR,
  INTEREST_OPTIONS,
  type OnboardingAnswers,
  SOURCE_OPTIONS,
  SOURCE_OPTIONS_HIDDEN_ON_MOBILE,
  WORK_FOR_OPTIONS,
} from "@/client/features/onboarding/onboardingModel";

/** The three question steps and the row shell they share. */

export type QuestionKey = "focus" | "context" | "source";

/**
 * One question step. They differ only in their copy and their answer list, so
 * the row, the Change affordance and the continue/skip pair are written once.
 */
function QuestionStep({
  number,
  title,
  status,
  description,
  doneLine,
  skippedLine,
  onResume,
  onReopen,
  onContinue,
  continueDisabled,
  onSkip,
  busy,
  children,
}: {
  number: number;
  title: string;
  status: StepStatus;
  description: string;
  doneLine: ReactNode;
  skippedLine: string;
  onResume: () => void;
  /** Reopens a finished step, which is how an answer gets changed. */
  onReopen: () => void;
  onContinue: () => void;
  continueDisabled: boolean;
  onSkip: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <OnboardingStepRow
      number={number}
      title={title}
      status={status}
      description={description}
      doneLine={doneLine}
      skippedLine={skippedLine}
      onResume={onResume}
      trailing={
        status === "done" ? (
          <MiniButton size="sm" style={{ fontSize: 12 }} onClick={onReopen}>
            Change
          </MiniButton>
        ) : null
      }
    >
      {children}
      <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
        <PrimaryButton onClick={onContinue} disabled={continueDisabled || busy}>
          Save and continue
        </PrimaryButton>
        <SecondaryButton onClick={onSkip} disabled={busy}>
          Skip for now
        </SecondaryButton>
      </div>
    </OnboardingStepRow>
  );
}

/**
 * The three steps that ask the user something. Their answers are the only data
 * this screen collects for itself; every other row reports on a real record.
 */
export function QuestionSteps({
  answers,
  onAnswersChange,
  statusOf,
  onResume,
  onReopen,
  onCommit,
  onSkip,
  busy,
}: {
  answers: OnboardingAnswers;
  onAnswersChange: (patch: Partial<OnboardingAnswers>) => void;
  statusOf: (key: QuestionKey) => StepStatus;
  onResume: (key: QuestionKey) => void;
  onReopen: (key: QuestionKey) => void;
  onCommit: (key: QuestionKey) => void;
  onSkip: (key: QuestionKey) => void;
  busy: boolean;
}) {
  return (
    <>
      <QuestionStep
        number={2}
        title="What you want from UpgradeSEO"
        status={statusOf("focus")}
        description="Pick up to three jobs that matter most to you. Your answer decides what we build next."
        doneLine={listAnswer(answers.selectedInterests, answers.interestOther)}
        skippedLine="Skipped. Nothing else on this list depends on it."
        onResume={() => onResume("focus")}
        onReopen={() => onReopen("focus")}
        onContinue={() => onCommit("focus")}
        continueDisabled={answers.selectedInterests.length === 0}
        onSkip={() => onSkip("focus")}
        busy={busy}
      >
        <ChoiceGroup
          groupLabel="What you want from UpgradeSEO"
          options={INTEREST_OPTIONS}
          selected={answers.selectedInterests}
          maxSelections={3}
          onToggle={(value) =>
            onAnswersChange({
              selectedInterests: answers.selectedInterests.includes(value)
                ? answers.selectedInterests.filter((item) => item !== value)
                : [...answers.selectedInterests, value],
            })
          }
          otherValue={answers.interestOther}
          onOtherChange={(interestOther) => onAnswersChange({ interestOther })}
          otherPlaceholder="Tell us what else"
        />
      </QuestionStep>

      <QuestionStep
        number={3}
        title="Who you are doing SEO for"
        status={statusOf("context")}
        description="One site of your own, a portfolio of clients, or a project you are still weighing up."
        doneLine={contextAnswer(answers)}
        skippedLine="Skipped. You can tell us later."
        onResume={() => onResume("context")}
        onReopen={() => onReopen("context")}
        onContinue={() => onCommit("context")}
        continueDisabled={!answers.workFor}
        onSkip={() => onSkip("context")}
        busy={busy}
      >
        <ChoiceGroup
          groupLabel="Who you are doing SEO for"
          options={WORK_FOR_OPTIONS}
          selected={answers.workFor ? [answers.workFor] : []}
          onToggle={(workFor) => onAnswersChange({ workFor })}
          otherValue={answers.workForOther}
          onOtherChange={(workForOther) => onAnswersChange({ workForOther })}
          otherPlaceholder="Tell us more"
          followUp={{
            showForValue: CLIENT_WORK_FOR,
            label: "About how many client sites do you work on?",
            options: CLIENT_WEBSITE_COUNT_OPTIONS,
            value: answers.clientWebsiteCount,
            onChange: (clientWebsiteCount) =>
              onAnswersChange({ clientWebsiteCount }),
          }}
        />
      </QuestionStep>

      <QuestionStep
        number={4}
        title="How you found UpgradeSEO"
        status={statusOf("source")}
        description="This one is just for us. It tells us where our time is best spent."
        doneLine={singleAnswer(answers.source, answers.sourceOther)}
        skippedLine="Skipped. You can tell us later."
        onResume={() => onResume("source")}
        onReopen={() => onReopen("source")}
        onContinue={() => onCommit("source")}
        continueDisabled={!answers.source}
        onSkip={() => onSkip("source")}
        busy={busy}
      >
        <ChoiceGroup
          groupLabel="How you found UpgradeSEO"
          options={SOURCE_OPTIONS}
          selected={answers.source ? [answers.source] : []}
          onToggle={(source) => onAnswersChange({ source })}
          otherValue={answers.sourceOther}
          onOtherChange={(sourceOther) => onAnswersChange({ sourceOther })}
          otherPlaceholder="Tell us more"
          hiddenOnMobile={SOURCE_OPTIONS_HIDDEN_ON_MOBILE}
        />
      </QuestionStep>
    </>
  );
}

/** "Other" is stored as free text, so show what the user actually typed. */
function singleAnswer(value: string, other: string): string {
  if (value === "Other") return other.trim() || "Other";
  return value;
}

function listAnswer(values: string[], other: string): string {
  return values.map((value) => singleAnswer(value, other)).join(", ");
}

function contextAnswer(answers: OnboardingAnswers): string {
  const base = singleAnswer(answers.workFor, answers.workForOther);
  return answers.workFor === CLIENT_WORK_FOR && answers.clientWebsiteCount
    ? `${base} · ${answers.clientWebsiteCount} sites`
    : base;
}
