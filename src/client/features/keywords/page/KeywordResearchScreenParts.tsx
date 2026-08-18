import { useEffect, useRef } from "react";
import {
  PrimaryButton,
  ScreenBody,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import { KEYWORD_RESEARCH_HEADERS } from "@/client/features/keywords/state/keywordControllerActions";
import { KeywordResearchEmptyState } from "./KeywordResearchEmptyState";
import { KeywordResearchLoadingState } from "./KeywordResearchLoadingState";
import { KeywordResearchResults } from "./KeywordResearchResults";
import { BarButton } from "./prominenceControls";
import type { KeywordResearchControllerState } from "./types";

export function HeaderActions({
  controller,
}: {
  controller: KeywordResearchControllerState;
}) {
  const selectedCount = controller.selectedRows.size;
  const canExport = controller.sheetsExportRows.length > 0;

  return (
    <>
      <SecondaryButton disabled={!canExport} onClick={controller.exportCsv}>
        Export CSV
      </SecondaryButton>
      <SecondaryButton
        disabled={!canExport}
        onClick={() =>
          void exportTableToSheets({
            headers: KEYWORD_RESEARCH_HEADERS,
            rows: controller.sheetsExportRows,
            feature: "keyword_research",
          })
        }
      >
        Export to Sheets
      </SecondaryButton>
      <PrimaryButton onClick={controller.handleSaveKeywords}>
        {selectedCount === 0
          ? "Select keywords to save"
          : `Save ${selectedCount} keyword${selectedCount === 1 ? "" : "s"}`}
      </PrimaryButton>
    </>
  );
}

/**
 * What the connected sources did and did not report. The design's table always
 * has a difficulty and an intent for every row; the free sources supply neither,
 * and a blank column with no explanation reads as a bug rather than a boundary.
 */
export function SourceNotes({
  controller,
}: {
  controller: KeywordResearchControllerState;
}) {
  const { rows } = controller;
  const missing: string[] = [];
  if (rows.length > 0 && rows.every((row) => row.keywordDifficulty === null)) {
    missing.push("keyword difficulty");
  }
  if (rows.length > 0 && rows.every((row) => row.intent === "unknown")) {
    missing.push("search intent");
  }

  if (missing.length === 0 && !controller.showApproximateMatchNotice) {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        padding: "8px var(--pad, 24px)",
        borderBottom: "1px solid var(--line)",
        fontSize: 12,
        color: "var(--text-3)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {controller.showApproximateMatchNotice ? (
        <span style={{ color: "var(--warning)" }}>
          {`No exact match for "${controller.searchedKeyword}". These are the closest related keywords.`}
        </span>
      ) : null}
      {missing.length > 0 ? (
        <span>
          {`The data sources connected to this project report no ${missing.join(
            " and no ",
          )}, so ${missing.length === 1 ? "that column is" : "those columns are"} left empty rather than filled with a guess.`}
        </span>
      ) : null}
    </div>
  );
}

export function KeywordResearchContent({
  controller,
  projectId,
  stacked,
}: {
  controller: KeywordResearchControllerState;
  projectId: string;
  stacked: boolean;
}) {
  if (controller.isLoading) {
    return <KeywordResearchLoadingState stacked={stacked} />;
  }

  if (controller.researchError) {
    return (
      <ScreenBody>
        <div
          role="alert"
          style={{
            border: "1px solid var(--danger-border)",
            background: "var(--danger-soft)",
            borderRadius: 8,
            padding: "12px 14px",
            maxWidth: 620,
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>
            {controller.researchError}
          </p>
          <BarButton style={{ marginTop: 10 }} onClick={controller.retrySearch}>
            Try again
          </BarButton>
        </div>
      </ScreenBody>
    );
  }

  if (controller.rows.length === 0) {
    return (
      <KeywordResearchEmptyState
        controller={controller}
        projectId={projectId}
      />
    );
  }

  return (
    <KeywordResearchResults
      controller={controller}
      projectId={projectId}
      stacked={stacked}
    />
  );
}

/**
 * Scope-before-commitment confirm for saving a selection, inline and in place.
 *
 * The design has no modal anywhere, so this is a strip in the document flow
 * directly above the table rather than an overlay. It keeps the two behaviours
 * the Forms & validation page asks of a confirm: Escape closes it, and focus
 * returns to whatever opened it.
 */
export function KeywordSaveConfirm({
  controller,
}: {
  controller: KeywordResearchControllerState;
}) {
  const { saveConfirmOpen, setSaveConfirmOpen } = controller;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!saveConfirmOpen) return;
    openerRef.current = document.activeElement;
    confirmRef.current?.focus();

    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [saveConfirmOpen]);

  if (!saveConfirmOpen) return null;

  const count = controller.selectedRows.size;
  const noun = count === 1 ? "keyword" : "keywords";

  return (
    <div
      style={{ padding: "12px var(--pad, 24px)" }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setSaveConfirmOpen(false);
      }}
    >
      <div
        role="group"
        aria-label={`Confirm saving ${count} ${noun}`}
        style={{
          maxWidth: 520,
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
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {`Save ${count} ${noun} to this project?`}
          </div>
          <p
            style={{
              margin: "5px 0 0",
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            {`${count} ${noun} · saved instantly, with the metrics that were actually reported for them. Nothing is re-checked and nothing is overwritten.`}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "10px 13px",
            background: "var(--subtle)",
          }}
        >
          <SecondaryButton
            disabled={controller.savePending}
            onClick={() => setSaveConfirmOpen(false)}
          >
            Cancel
          </SecondaryButton>
          {/* Plain button rather than the PrimaryButton primitive because this
              one has to take a ref to receive focus when the confirm opens.
              The shared class carries the identical accent styling. */}
          <button
            ref={confirmRef}
            type="button"
            className="prominence-button-primary"
            disabled={controller.savePending}
            aria-busy={controller.savePending || undefined}
            onClick={controller.confirmSave}
          >
            {controller.savePending ? "Saving…" : `Save ${count} ${noun}`}
          </button>
        </div>
      </div>
    </div>
  );
}
