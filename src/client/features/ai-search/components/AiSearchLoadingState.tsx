import { SkeletonBar } from "@/client/features/ai-search/components/aiControls";
import { BrandLookupStatStrip } from "@/client/features/ai-search/components/BrandLookupStatStrip";

const SKELETON_ROWS = 6;

/**
 * First-load skeleton for a brand lookup. It draws the panel exactly as it will
 * settle, stat strip over full-bleed table, so nothing moves when the model
 * answers. The design has no loading state at all; the shimmer keyframes it
 * ships are reused so a pending table reads as pending and not as an empty
 * result.
 */
export function AiSearchLoadingState({
  /** The competitor share tab has no stat strip and no table toolbar. */
  withStats = true,
}: {
  withStats?: boolean;
}) {
  return (
    <div aria-busy role="status" aria-label="Measuring AI visibility">
      {withStats ? (
        <>
          <BrandLookupStatStrip result={null} />
          <div
            style={{
              padding: "8px var(--pad, 24px)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <SkeletonBar width={180} height={22} />
          </div>
        </>
      ) : null}
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table
          style={{
            width: "100%",
            minWidth: 560,
            borderCollapse: "collapse",
            fontSize: 12.5,
          }}
        >
          <tbody>
            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <tr
                key={index}
                aria-hidden="true"
                style={{ borderBottom: "1px solid var(--border-muted)" }}
              >
                <td style={{ padding: "var(--rp, 5px) var(--pad, 24px)" }}>
                  <SkeletonBar width="55%" />
                </td>
                <td style={{ padding: "var(--rp, 5px) 12px" }}>
                  <SkeletonBar width={70} />
                </td>
                <td style={{ padding: "var(--rp, 5px) 12px" }}>
                  <SkeletonBar width={90} />
                </td>
                <td
                  style={{
                    padding:
                      "var(--rp, 5px) var(--pad, 24px) var(--rp, 5px) 12px",
                    textAlign: "right",
                  }}
                >
                  <SkeletonBar width={48} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
