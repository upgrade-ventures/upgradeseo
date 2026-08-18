import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { withPgClient } from "@/db";
import type { OrganizationContext } from "@/server/auth/organizationContext";
import { RankTrackingRepository } from "@/server/features/rank-tracking/repositories/RankTrackingRepository";
import { failRunIfActive } from "@/server/features/rank-tracking/services/rankCheckRunGuards";
import { runFreeRankCheck } from "@/server/features/rank-tracking/services/freeRankSource";
import { pgStep } from "@/server/workflows/pgStep";
import { captureServerEvent } from "@/server/lib/posthog";
import { AppError } from "@/server/lib/errors";

/**
 * Scheduled rank checks.
 *
 * This workflow used to pace and poll a paid SERP task queue: post one task per
 * keyword/device pair, sleep, collect, fall back to the live endpoint. The free
 * sources answer for a whole tracked domain in one or two calls, so all of that
 * is gone and one step does the work. What the workflow still buys the cron
 * handler is durable execution per config: a tick claims the config, starts an
 * instance and moves on, and a failure here fails that config's run rather than
 * the whole tick.
 *
 * Manual checks do not come through here at all. RankTrackingService runs them
 * inline, because there is nothing left to pace.
 */

const SINGLE_ATTEMPT_STEP_CONFIG = {
  retries: { limit: 0, delay: "1 second" as const },
  timeout: "2 minutes" as const,
};

interface RankCheckParams {
  runId: string;
  configId: string;
  billingCustomer: OrganizationContext;
  projectId: string;
  domain: string;
  locationCode: number;
  devices: "both" | "desktop" | "mobile";
  trigger: "manual" | "scheduled";
  keywordIds?: string[];
  // Inert, and kept only because beginRankCheckRun still populates them from
  // the config row. The free sources take no SERP depth, filter Search Console
  // by country rather than language, and are unmetered, so none of these
  // reaches an upstream call. Dropping them here would break that caller's
  // object literal, which is outside this file.
  languageCode: string;
  locationName?: string;
  serpDepth: number;
}

/**
 * Load the tracked keywords, ask the free sources for their positions, and
 * persist the snapshots. Returns the notice that has to travel with the run.
 */
async function runFreeCheckStep(input: {
  runId: string;
  configId: string;
  projectId: string;
  organizationId: string;
  domain: string;
  locationCode: number;
  devices: RankCheckParams["devices"];
  keywordIds?: string[];
}): Promise<{ notice: string }> {
  // If stale-cleanup marked our run failed before we got here, bail out
  // rather than resurrecting a superseded run.
  const run = await RankTrackingRepository.getRunById(input.runId);
  if (!run || run.status === "failed" || run.status === "completed") {
    throw new NonRetryableError(
      `Run ${input.runId} is no longer active (status=${run?.status ?? "missing"})`,
    );
  }

  await RankTrackingRepository.updateRun(input.runId, { status: "running" });

  let trackingKeywords = await RankTrackingRepository.getKeywordsForConfig(
    input.configId,
  );
  if (input.keywordIds && input.keywordIds.length > 0) {
    const idSet = new Set(input.keywordIds);
    trackingKeywords = trackingKeywords.filter((kw) => idSet.has(kw.id));
  }
  if (trackingKeywords.length === 0) {
    throw new AppError("INTERNAL_ERROR", "No keywords to track");
  }

  await RankTrackingRepository.updateRun(input.runId, {
    keywordsTotal: trackingKeywords.length,
  });

  const result = await runFreeRankCheck({
    projectId: input.projectId,
    organizationId: input.organizationId,
    domain: input.domain,
    locationCode: input.locationCode,
    devices: input.devices,
    keywords: trackingKeywords.map((kw) => ({
      id: kw.id,
      keyword: kw.keyword,
    })),
  });
  if (!result) {
    // null is the free helper's leftover "let the paid client answer" signal,
    // and there is no paid client any more. Say what to connect instead of
    // completing a run with nothing in it.
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      "No rank source is connected. Connect a Google Search Console property covering this domain for Google positions, or add a free Bing Webmaster key for Bing positions.",
    );
  }

  if (result.rows.length > 0) {
    await RankTrackingRepository.insertSnapshots(
      // Free sources report no SERP features. Null is "unknown", where an empty
      // array would claim the SERP has none.
      result.rows.map((row) => ({
        ...row,
        runId: input.runId,
        serpFeatures: null,
      })),
    );
  }

  return { notice: result.notice };
}

async function finalizeRankCheckRun(input: {
  runId: string;
  configId: string;
  projectId: string;
  billingCustomer: OrganizationContext;
  trigger: RankCheckParams["trigger"];
  notice: string;
}) {
  // If stale-cleanup already marked our run failed, don't overwrite that
  // decision with a completed status — a replacement run may already be
  // underway.
  const run = await RankTrackingRepository.getRunById(input.runId);
  if (!run || run.status === "failed" || run.status === "completed") {
    console.warn(
      `[rank-check] ${input.runId} no longer active (status=${run?.status ?? "missing"}), skipping finalization`,
    );
    return;
  }

  const nowIso = new Date().toISOString();

  // Snapshots were written by the check step. Count from DB to get the
  // authoritative keyword count.
  const snapshots = await RankTrackingRepository.getSnapshotsForRun(
    input.runId,
  );
  const keywordsChecked = new Set(snapshots.map((s) => s.trackingKeywordId))
    .size;
  const keywordsTotal = run.keywordsTotal || keywordsChecked;

  // Flipping status away from 'pending'/'running' is what releases the
  // partial-index slot for the next run.
  await RankTrackingRepository.updateRun(input.runId, {
    status: "completed",
    keywordsChecked,
    completedAt: nowIso,
    // The source label rides on errorMessage: rank_check_runs has no label
    // column and this field is already the run's free-text notice channel.
    // Nobody may read a Search Console window average as a live SERP position,
    // so the sentence has to travel with the run. It also explains any keyword
    // the source had no data for, which is why no separate "N could not be
    // checked" message is written here.
    errorMessage: input.notice,
  });

  // Clear any previous skip reason on success.
  // Note: nextCheckAt is NOT set here — the cron handler advances it eagerly
  // before starting the workflow to prevent retry storms.
  await RankTrackingRepository.updateConfig(input.configId, input.projectId, {
    lastCheckedAt: nowIso,
    lastSkipReason: null,
  });

  // One-line summary per run so coverage is visible in Workers Logs.
  // Keys match the PostHog event properties for log/event correlation.
  console.log(
    `[rank-check] ${input.runId} completed org=${input.billingCustomer.organizationId} project=${input.projectId} trigger=${input.trigger} keywords=${keywordsChecked}/${keywordsTotal}`,
  );

  await captureServerEvent({
    distinctId: input.billingCustomer.userId,
    event: "rank_tracking:check_complete",
    organizationId: input.billingCustomer.organizationId,
    properties: {
      project_id: input.projectId,
      status: "completed",
      trigger: input.trigger,
      keywords_checked: keywordsChecked,
    },
  });
}

async function markRankCheckRunFailed(input: {
  runId: string;
  billingCustomer: OrganizationContext;
  projectId: string;
  error: unknown;
}) {
  const errorMessage =
    input.error instanceof Error ? input.error.message : "Unknown error";
  await failRunIfActive(input.runId, errorMessage);

  await captureServerEvent({
    distinctId: input.billingCustomer.userId,
    event: "rank_tracking:check_complete",
    organizationId: input.billingCustomer.organizationId,
    properties: {
      project_id: input.projectId,
      status: "failed",
      error: errorMessage,
    },
  });
}

export class RankCheckWorkflow extends WorkflowEntrypoint<
  Env,
  RankCheckParams
> {
  async run(event: WorkflowEvent<RankCheckParams>, step: WorkflowStep) {
    // Scope a per-request Postgres client for this workflow invocation (no-op in
    // D1 mode). The socket is reclaimed when the invocation ends, so there is
    // nothing to tear down here.
    return withPgClient(() => this.runScoped(event, step));
  }

  private async runScoped(
    event: WorkflowEvent<RankCheckParams>,
    step: WorkflowStep,
  ) {
    const {
      runId,
      configId,
      billingCustomer,
      projectId,
      domain,
      locationCode,
      devices,
      trigger,
      keywordIds,
    } = event.payload;

    // Guard: skip if config was archived after the workflow was triggered
    const configCheck = await pgStep(
      step,
      "check-active",
      { retries: { limit: 0, delay: "1 second" } },
      async () => {
        const cfg = await RankTrackingRepository.getConfigById({
          configId,
          projectId,
        });
        return { isActive: cfg?.isActive ?? false };
      },
    );
    if (!configCheck.isActive) {
      await failRunIfActive(runId, "Config has been archived");
      return;
    }

    try {
      console.log(
        `[rank-check] ${runId} starting (trigger=${trigger}, devices=${devices})`,
      );

      const { notice } = await pgStep(
        step,
        "free-check",
        SINGLE_ATTEMPT_STEP_CONFIG,
        async () =>
          runFreeCheckStep({
            runId,
            configId,
            projectId,
            organizationId: billingCustomer.organizationId,
            domain,
            locationCode,
            devices,
            keywordIds,
          }),
      );

      await pgStep(step, "finalize", SINGLE_ATTEMPT_STEP_CONFIG, async () =>
        finalizeRankCheckRun({
          runId,
          configId,
          projectId,
          billingCustomer,
          trigger,
          notice,
        }),
      );
    } catch (error) {
      console.error(`Rank check ${runId} failed:`, error);
      await pgStep(step, "mark-failed", SINGLE_ATTEMPT_STEP_CONFIG, async () =>
        markRankCheckRunFailed({
          runId,
          projectId,
          billingCustomer,
          error,
        }),
      );
      throw error;
    }
  }
}
