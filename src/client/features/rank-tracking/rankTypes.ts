import type { getLatestRankRun } from "@/serverFunctions/rank-tracking";

/** The four tabs of the rank screen, in the design's order. */
export type RankTab = "keywords" | "history" | "competitors" | "activity";

/**
 * The polled run, exactly as the server function reports it. `undefined` while
 * the first poll is in flight, `null` when the config has never run a check —
 * two different things on this screen, so neither is collapsed.
 */
export type RankLatestRun =
  | Awaited<ReturnType<typeof getLatestRankRun>>
  | undefined;
