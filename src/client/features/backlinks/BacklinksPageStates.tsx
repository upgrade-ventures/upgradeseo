import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { Icon } from "@/client/components/icons/IconSprite";

function Shimmer({
  width,
  height = 10,
}: {
  width: number | string;
  height?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width,
        height,
        borderRadius: 3,
        background: "var(--inset)",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

/** Placeholder for the counter strip and the first table, while both load. */
export function BacklinksLoadingState() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        Loading backlink profile
      </span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          borderBottom: "1px solid var(--line)",
        }}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            style={{
              padding: "13px 20px",
              borderRight:
                index === 4 ? undefined : "1px solid var(--border-muted)",
              display: "grid",
              gap: 9,
            }}
          >
            <Shimmer width={92} height={9} />
            <Shimmer width={64} height={18} />
          </div>
        ))}
      </div>
      <div
        style={{
          background: "var(--subtle)",
          borderBottom: "1px solid var(--line)",
          padding: "8px var(--pad, 24px)",
        }}
      >
        <Shimmer width={140} height={9} />
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            padding: "9px var(--pad, 24px)",
            borderBottom: "1px solid var(--border-muted)",
          }}
        >
          <Shimmer width="34%" />
          <Shimmer width="18%" />
          <Shimmer width="22%" />
        </div>
      ))}
    </div>
  );
}

export function BacklinksErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null;
  onRetry: () => void;
}) {
  return (
    <div style={{ padding: "16px var(--pad, 24px)" }}>
      <section
        style={{
          display: "flex",
          gap: 10,
          padding: "12px 14px",
          border: "1px solid var(--danger-border)",
          borderRadius: 8,
          background: "var(--danger-soft)",
        }}
      >
        <Icon
          name="i-alert"
          size={16}
          style={{ color: "var(--danger)", marginTop: 1 }}
        />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            Could not load backlinks
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            {errorMessage ?? "Please try again in a moment."}
          </p>
          <div style={{ marginTop: 10 }}>
            <SecondaryButton icon="i-refresh" onClick={onRetry}>
              Retry
            </SecondaryButton>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A tab whose own request failed, above the table shell. */
export function BacklinksTabError({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        margin: "14px var(--pad, 24px)",
        padding: "9px 12px",
        border: "1px solid var(--danger-border)",
        borderRadius: 8,
        background: "var(--danger-soft)",
        fontSize: 12.5,
        color: "var(--text-2)",
      }}
      role="alert"
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: "var(--danger)",
          flexShrink: 0,
          marginTop: 5,
        }}
      />
      <span>{message}</span>
    </div>
  );
}
