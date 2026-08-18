import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteAudit,
  getAuditHistory,
  startAudit,
} from "@/serverFunctions/audit";
import {
  DEFAULT_LAUNCH_FORM_VALUES,
  MAX_PAGES,
  MIN_PAGES,
  type LaunchFormValues,
} from "@/client/features/audit/launch/types";
import {
  createFormValidationErrors,
  shouldValidateFieldOnChange,
} from "@/client/lib/forms";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

/** The scope a crawl was confirmed at, held between confirm and start. */
type PendingLaunch = {
  url: string;
  maxPages: number;
  runLighthouse: boolean;
};

/**
 * Every message here names the fix rather than the fault, which is the design's
 * rule for validation copy: "Every message says what to do, not just what is
 * wrong."
 */
function getLaunchValidationErrors(
  value: LaunchFormValues,
  shouldValidateUntouchedField: boolean,
) {
  const url = value.url.trim();

  if (!url) {
    return shouldValidateUntouchedField
      ? createFormValidationErrors({
          fields: {
            url: "Enter the address to start from, for example https://example.com.",
          },
        })
      : null;
  }

  if (!isCrawlableUrl(url)) {
    return createFormValidationErrors({
      fields: {
        url: "That is not an address we can crawl. Try https://example.com — one address, no spaces.",
      },
    });
  }

  return null;
}

function isCrawlableUrl(value: string): boolean {
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.includes(".") &&
      !/\s/.test(value)
    );
  } catch {
    return false;
  }
}

export function useLaunchController({
  projectId,
  onAuditStarted,
}: {
  projectId: string;
  onAuditStarted: (auditId: string) => void;
}) {
  const maxPagesLimit = MAX_PAGES;
  const [pendingLaunch, setPendingLaunch] = useState<PendingLaunch | null>(
    null,
  );
  const historyQuery = useQuery({
    queryKey: ["audit-history", projectId],
    queryFn: () => getAuditHistory({ data: { projectId } }),
  });
  const { startMutation, deleteMutation } = useLaunchMutations({
    projectId,
    historyRefetch: historyQuery.refetch,
  });

  const launchForm = useForm({
    defaultValues: DEFAULT_LAUNCH_FORM_VALUES,
    validators: {
      onChange: ({ formApi, value }) =>
        getLaunchValidationErrors(
          value,
          shouldValidateFieldOnChange(formApi, "url"),
        ),
      onSubmit: ({ value }) => getLaunchValidationErrors(value, true),
    },
    // Submitting no longer starts the crawl. It states the scope and waits, so
    // a thousand-page crawl is never begun by one stray Enter.
    onSubmit: ({ formApi, value }) => {
      const effectiveMaxPages = commitMaxPagesInput(launchForm, maxPagesLimit);
      formApi.setErrorMap({ onSubmit: undefined });
      setPendingLaunch({
        url: value.url.trim(),
        maxPages: effectiveMaxPages,
        runLighthouse: value.runLighthouse,
      });
    },
  });

  const confirmLaunch = async () => {
    if (!pendingLaunch) return;
    try {
      const result = await startMutation.mutateAsync({
        projectId,
        startUrl: pendingLaunch.url,
        maxPages: pendingLaunch.maxPages,
        lighthouseStrategy: pendingLaunch.runLighthouse ? "auto" : "none",
      });
      setPendingLaunch(null);
      toast.success(
        `Crawl queued for up to ${pendingLaunch.maxPages.toLocaleString()} pages`,
      );
      onAuditStarted(result.auditId);
    } catch (error) {
      setPendingLaunch(null);
      launchForm.setErrorMap({
        onSubmit: createFormValidationErrors({
          form: getStandardErrorMessage(error, "Failed to start audit"),
        }),
      });
    }
  };

  return {
    launchForm,
    historyQuery,
    maxPagesLimit,
    pendingLaunch,
    isStarting: startMutation.isPending,
    confirmLaunch: () => void confirmLaunch(),
    cancelLaunch: () => setPendingLaunch(null),
    commitMaxPagesInput: () => commitMaxPagesInput(launchForm, maxPagesLimit),
    deleteAudit: (auditId: string) => deleteMutation.mutate(auditId),
  };
}

function useLaunchMutations({
  projectId,
  historyRefetch,
}: {
  projectId: string;
  historyRefetch: () => Promise<unknown>;
}) {
  const startMutation = useMutation({
    mutationFn: (data: {
      projectId: string;
      startUrl: string;
      maxPages: number;
      lighthouseStrategy: "auto" | "none";
    }) => startAudit({ data }),
  });

  const deleteMutation = useMutation({
    mutationFn: (auditId: string) =>
      deleteAudit({ data: { projectId, auditId } }),
    onSuccess: () => {
      void historyRefetch();
      toast.success("Audit deleted");
    },
  });

  return { startMutation, deleteMutation };
}

function commitMaxPagesInput(
  launchForm: {
    state: { values: { maxPagesInput: string } };
    setFieldValue: (field: "maxPagesInput", value: string) => void;
  },
  maxPagesLimit: number,
) {
  const maxPagesInput = launchForm.state.values.maxPagesInput;
  const value = maxPagesInput ? Number.parseInt(maxPagesInput, 10) : MIN_PAGES;
  const safeValue = Number.isFinite(value)
    ? Math.max(MIN_PAGES, Math.min(maxPagesLimit, Math.round(value)))
    : MIN_PAGES;
  launchForm.setFieldValue("maxPagesInput", String(safeValue));
  return safeValue;
}
