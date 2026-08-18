import { useEffect } from "react";
import {
  PageHeaderBand,
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { SCREEN_WRAP } from "@/client/features/audit/auditStyles";
import { AuditHistorySection } from "@/client/features/audit/launch/AuditHistorySection";
import {
  LaunchFormCard,
  SUBMIT_BUTTON_ID,
} from "@/client/features/audit/launch/LaunchFormCard";
import { useLaunchController } from "@/client/features/audit/launch/useLaunchController";

/** The confirm step's own action, so the effect below can land focus on it. */
const CONFIRM_BUTTON_ID = "audit-launch-confirm";

type LaunchViewProps = {
  projectId: string;
  onAuditStarted: (auditId: string) => void;
  onOpenAudit: (auditId: string) => void;
};

/**
 * What the screen shows before a crawl is selected.
 *
 * The design only draws a crawl that already exists, so this reuses its header
 * band, card and table rules rather than inventing a second visual language for
 * the entry point.
 */
export function LaunchView({
  projectId,
  onAuditStarted,
  onOpenAudit,
}: LaunchViewProps) {
  const controller = useLaunchController({ projectId, onAuditStarted });

  return (
    <div style={SCREEN_WRAP}>
      <PageHeaderBand
        title="Site Audit"
        subtitle="Crawl this site to find broken links, missing metadata, redirect chains and slow pages."
      />

      <div style={{ padding: "16px var(--pad, 24px)", maxWidth: 820 }}>
        <LaunchFormCard
          launchForm={controller.launchForm}
          commitMaxPagesInput={controller.commitMaxPagesInput}
          maxPagesLimit={controller.maxPagesLimit}
        />

        {controller.pendingLaunch ? (
          <LaunchConfirm
            title={`Crawl up to ${controller.pendingLaunch.maxPages.toLocaleString()} pages of ${hostOf(controller.pendingLaunch.url)}?`}
            // Scope is stated in pages and in what else the run does. No
            // duration: nothing in this repo measures crawl rate, and an
            // invented "about two minutes" would be a number nobody took.
            body={`This fetches every page we can reach from ${controller.pendingLaunch.url}, stopping at ${controller.pendingLaunch.maxPages.toLocaleString()}.${
              controller.pendingLaunch.runLighthouse
                ? " Lighthouse then scores a sample of up to 20 of them, which adds several minutes."
                : ""
            } It runs in the background and you can close the page.`}
            busy={controller.isStarting}
            onConfirm={controller.confirmLaunch}
            onCancel={controller.cancelLaunch}
          />
        ) : null}
      </div>

      <AuditHistorySection
        history={controller.historyQuery.data ?? []}
        isLoading={controller.historyQuery.isLoading}
        onOpen={onOpenAudit}
        onDelete={controller.deleteAudit}
      />
    </div>
  );
}

/**
 * The design's "Confirm before spending" card, from the Forms & validation
 * page: a scope sentence, Cancel, and the primary action.
 *
 * It is rendered in place under the form rather than as an overlay. The design
 * carries no `role="dialog"` and no `aria-modal` on any of its 394KB of
 * screens, so a crawl is confirmed in the second step of the same form, not
 * behind a scrim that traps focus and hides the values being confirmed.
 */
function LaunchConfirm({
  title,
  body,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // The step exists to be answered, so the answer is where the caret lands.
  useEffect(() => {
    document.getElementById(CONFIRM_BUTTON_ID)?.focus();
  }, []);

  const cancel = () => {
    onCancel();
    // Focus goes back to the control that raised this step, the way it would
    // have come back from a dialog.
    document.getElementById(SUBMIT_BUTTON_ID)?.focus();
  };

  return (
    <div
      role="group"
      aria-label="Confirm the crawl"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        cancel();
      }}
      style={{
        marginTop: 12,
        border: "1px solid var(--line)",
        borderRadius: 8,
        boxShadow: "var(--shadow)",
        background: "var(--overlay)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "11px 13px",
          borderBottom: "1px solid var(--border-muted)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        <p
          style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--text-2)" }}
        >
          {body}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          padding: "10px 13px",
          background: "var(--subtle)",
          flexWrap: "wrap",
        }}
      >
        <SecondaryButton onClick={cancel} disabled={busy}>
          Cancel
        </SecondaryButton>
        <PrimaryButton
          id={CONFIRM_BUTTON_ID}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Starting…" : "Start crawl"}
        </PrimaryButton>
      </div>
    </div>
  );
}

/** The host alone reads better in a title than the whole address does. */
function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}
