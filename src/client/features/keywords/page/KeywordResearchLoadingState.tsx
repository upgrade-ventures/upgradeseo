import { Skeleton } from "./prominenceControls";

/**
 * The design ships no loading state for this screen: its rows stay fully
 * rendered while a search runs. Real rows take seconds to arrive, and leaving
 * the previous result on screen would read as the answer to the new query, so
 * the table's own geometry is redrawn as placeholders.
 */
export function KeywordResearchLoadingState({ stacked }: { stacked: boolean }) {
  return (
    <div
      aria-busy
      aria-live="polite"
      aria-label="Loading keywords"
      style={{
        display: "grid",
        gridTemplateColumns: stacked
          ? "minmax(0, 1fr)"
          : "minmax(360px, 1fr) minmax(240px, 320px)",
        alignItems: "start",
      }}
    >
      <div>
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
              {Array.from({ length: 10 }).map((_, index) => (
                <tr
                  key={index}
                  style={{ borderBottom: "1px solid var(--border-muted)" }}
                >
                  <td
                    style={{
                      width: 32,
                      padding:
                        "var(--rp, 5px) 0 var(--rp, 5px) var(--pad, 24px)",
                    }}
                  >
                    <Skeleton width={12} height={12} />
                  </td>
                  <td style={{ padding: "var(--rp, 5px) 8px" }}>
                    <Skeleton width="70%" height={13} />
                  </td>
                  <td style={{ padding: "var(--rp, 5px) 8px" }}>
                    <Skeleton
                      width={48}
                      height={13}
                      style={{ marginLeft: "auto" }}
                    />
                  </td>
                  <td style={{ padding: "var(--rp, 5px) 8px" }}>
                    <Skeleton
                      width={36}
                      height={13}
                      style={{ marginLeft: "auto" }}
                    />
                  </td>
                  <td style={{ padding: "var(--rp, 5px) 8px" }}>
                    <Skeleton
                      width={36}
                      height={13}
                      style={{ marginLeft: "auto" }}
                    />
                  </td>
                  <td style={{ padding: "var(--rp, 5px) 8px" }}>
                    <Skeleton
                      width={26}
                      height={15}
                      style={{ marginLeft: "auto", borderRadius: 5 }}
                    />
                  </td>
                  <td
                    style={{
                      padding:
                        "var(--rp, 5px) var(--pad, 24px) var(--rp, 5px) 8px",
                    }}
                  >
                    <Skeleton
                      width={62}
                      height={15}
                      style={{ margin: "0 auto", borderRadius: 5 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          borderLeft: stacked ? "none" : "1px solid var(--line)",
          borderTop: stacked ? "1px solid var(--line)" : "none",
          alignSelf: "stretch",
          minHeight: "100%",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Skeleton width={120} height={13} />
        <Skeleton width="60%" height={18} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} width="100%" height={34} />
          ))}
        </div>
        <Skeleton width="100%" height={72} />
      </div>
    </div>
  );
}
