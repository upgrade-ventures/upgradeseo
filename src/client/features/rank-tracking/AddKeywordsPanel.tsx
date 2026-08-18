import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { addTrackingKeywords } from "@/serverFunctions/rank-tracking";
import {
  MAX_KEYWORDS_PER_CONFIG,
  MAX_TRACKED_KEYWORD_LENGTH,
} from "@/shared/rank-tracking";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  Field,
  FieldSuccess,
  TextArea,
  useBlurValidation,
} from "@/client/components/prominence/Field";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";

/** One keyword per line, trimmed, blanks dropped. */
function parseLines(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function firstDuplicate(lines: string[]): string | null {
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) return line;
    seen.add(key);
  }
  return null;
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The design's keyword field, from the Forms & validation page: one per line,
 * de-duplicated for you, with a counter that says what will actually be added
 * and a message that offers the fix rather than only naming the fault.
 */
export function AddKeywordsPanel({
  configId,
  projectId,
  onSuccess,
  onCancel,
}: {
  configId: string;
  projectId: string;
  onSuccess: (result: { added: number; checkTriggered: boolean }) => void;
  onCancel: () => void;
}) {
  const [keywordInput, setKeywordInput] = useState("");
  const lines = parseLines(keywordInput);
  const unique = uniqueLines(lines);

  const validation = useBlurValidation(keywordInput, () => {
    if (lines.length === 0) return null;

    const tooLong = lines.find(
      (line) => line.length > MAX_TRACKED_KEYWORD_LENGTH,
    );
    if (tooLong) {
      return `“${tooLong.slice(0, 40)}…” is ${tooLong.length} characters. Keep each keyword to ${MAX_TRACKED_KEYWORD_LENGTH} or fewer.`;
    }

    if (unique.length > MAX_KEYWORDS_PER_CONFIG) {
      return `That is ${unique.length.toLocaleString()} keywords. A set holds ${MAX_KEYWORDS_PER_CONFIG.toLocaleString()}, so remove ${(unique.length - MAX_KEYWORDS_PER_CONFIG).toLocaleString()} of them.`;
    }

    const duplicate = firstDuplicate(lines);
    if (duplicate) {
      return `“${duplicate}” appears more than once. Remove the duplicate, or use De-duplicate below — either way nothing is lost.`;
    }

    return null;
  });

  const mutation = useMutation({
    mutationFn: (keywords: string[]) =>
      addTrackingKeywords({ data: { projectId, configId, keywords } }),
    onSuccess: (result) => {
      setKeywordInput("");
      onSuccess(result);
    },
    onError: (error) => {
      toast.error(getStandardErrorMessage(error, "Failed to add keywords"));
    },
  });

  const canSubmit =
    unique.length > 0 && validation.isValid && !mutation.isPending;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 620,
      }}
    >
      <Field
        label="Keywords to add"
        required
        description="One per line, or paste a list. We trim each line and drop blanks for you."
        error={validation.error}
        disabled={mutation.isPending}
        hint={
          unique.length > 0 && validation.isValid ? (
            <FieldSuccess>
              Ready to add {unique.length.toLocaleString()}
            </FieldSuccess>
          ) : lines.length > 0 && unique.length !== lines.length ? (
            "Duplicates are counted once."
          ) : (
            `Up to ${MAX_KEYWORDS_PER_CONFIG.toLocaleString()} keywords in a set.`
          )
        }
        counter={
          lines.length === 0
            ? undefined
            : `${lines.length} line${lines.length === 1 ? "" : "s"} · ${unique.length} unique · limit ${MAX_KEYWORDS_PER_CONFIG.toLocaleString()}`
        }
      >
        {(control) => (
          <TextArea
            {...control}
            rows={4}
            value={keywordInput}
            placeholder={"open source seo tool\nfree rank tracker"}
            onChange={(event) => setKeywordInput(event.target.value)}
            {...validation.fieldProps}
          />
        )}
      </Field>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <PrimaryButton
          onClick={() => {
            validation.reveal();
            if (!canSubmit) return;
            mutation.mutate(unique);
          }}
          disabled={!canSubmit}
          style={mutation.isPending ? { cursor: "progress" } : undefined}
          title={
            unique.length === 0
              ? "Enter at least one keyword"
              : validation.isValid
                ? undefined
                : "Fix the message above to continue"
          }
        >
          {mutation.isPending
            ? "Adding…"
            : unique.length > 0
              ? `Add ${unique.length} keyword${unique.length === 1 ? "" : "s"}`
              : "Add keywords"}
        </PrimaryButton>
        {unique.length !== lines.length ? (
          <SecondaryButton onClick={() => setKeywordInput(unique.join("\n"))}>
            De-duplicate
          </SecondaryButton>
        ) : null}
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
