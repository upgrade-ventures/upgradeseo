/**
 * The one status vocabulary.
 *
 * The Design foundations page fixes five states and five words for every job in
 * the product: Queued, Running, Finished, Needs attention, Failed. A screen may
 * not coin a sixth, and it may not rename one of these, because the whole point
 * is that a state read on Site Audit means the same thing when it is read on
 * Rank Tracking.
 *
 * Colour never carries the meaning: every pill draws a dot AND the word, so the
 * state survives greyscale, colour-blindness and a low-contrast display.
 *
 * This does not route through `StatusPill` in Primitives. `StatusPill` takes an
 * icon rather than a dot, and its neutral tone fills with `--subtle` where the
 * foundations page fills Queued with `--inset`. Those are two different
 * components that happen to share a shape.
 */

export type JobState =
  | "queued"
  | "running"
  | "finished"
  | "needs-attention"
  | "failed";

/** Wording and colour, taken verbatim from the Design foundations page. */
const JOB_STATE: Record<
  JobState,
  { label: string; fg: string; bg: string; bd: string }
> = {
  queued: {
    label: "Queued",
    fg: "var(--text-2)",
    bg: "var(--inset)",
    bd: "var(--line)",
  },
  running: {
    label: "Running",
    fg: "var(--info)",
    bg: "var(--info-soft)",
    bd: "var(--info-border)",
  },
  finished: {
    label: "Finished",
    fg: "var(--success)",
    bg: "var(--success-soft)",
    bd: "var(--success-border)",
  },
  "needs-attention": {
    label: "Needs attention",
    fg: "var(--warning)",
    bg: "var(--warning-soft)",
    bd: "var(--warning-border)",
  },
  failed: {
    label: "Failed",
    fg: "var(--danger)",
    bg: "var(--danger-soft)",
    bd: "var(--danger-border)",
  },
};

/**
 * Map a stored run status onto the vocabulary.
 *
 * Two tables spell the same lifecycle differently: rank check runs start
 * "pending", audit crawls start straight at "running". Both end "completed" or
 * "failed". `needsAttention` is the one state the database does not store: a run
 * that completed while leaving something for the user to decide (a partial
 * check, a crawl that reached a single page) is Finished plus a decision, which
 * the foundations page names Needs attention.
 */
export function runJobState(
  /** "pending" | "queued" | "running" | "completed" | "failed". */
  status: string,
  options?: { needsAttention?: boolean },
): JobState {
  if (status === "failed") return "failed";
  if (status === "pending" || status === "queued") return "queued";
  if (status === "running") return "running";
  if (status === "completed") {
    return options?.needsAttention ? "needs-attention" : "finished";
  }
  // An unknown status is not silently drawn as one of the five: the caller is
  // reporting something this vocabulary does not cover, and Needs attention is
  // the state that asks a person to look.
  return "needs-attention";
}

export function JobStatusPill({
  state,
  title,
}: {
  state: JobState;
  /** Native tooltip, e.g. the run's own timestamp or failure reason. */
  title?: string;
}) {
  const tone = JOB_STATE[state];
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        width: "fit-content",
        height: 20,
        padding: "0 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        color: tone.fg,
        background: tone.bg,
        border: `1px solid ${tone.bd}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {tone.label}
    </span>
  );
}
