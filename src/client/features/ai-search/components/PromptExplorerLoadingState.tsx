import { SkeletonBar } from "@/client/features/ai-search/components/aiControls";

/**
 * The answer card in its pending shape, so the panel does not jump when the
 * answer lands. The design has no loading state beyond the run button's
 * spinner.
 */
export function PromptExplorerLoadingState() {
  return (
    <div
      role="status"
      aria-busy
      aria-label="Waiting for the answer"
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        overflow: "hidden",
        maxWidth: 820,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 12px",
          background: "var(--subtle)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <SkeletonBar width={120} height={13} />
        <SkeletonBar width={80} height={11} />
      </div>
      <div
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        <SkeletonBar width="100%" />
        <SkeletonBar width="92%" />
        <SkeletonBar width="84%" />
        <SkeletonBar width="70%" />
      </div>
    </div>
  );
}
