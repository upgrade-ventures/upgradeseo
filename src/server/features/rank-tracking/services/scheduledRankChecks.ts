import { RankTrackingRepository } from "@/server/features/rank-tracking/repositories/RankTrackingRepository";
import { beginRankCheckRun } from "@/server/features/rank-tracking/services/rankCheckRunGuards";
import {
  computeNextCheckAt,
  devicesCount,
  isScheduledRankTrackingInterval,
} from "@/shared/rank-tracking";

// Work admitted per tick, in task units (keywords × devices). Admission
// control, not a hard rate limit: the first start of a tick is always
// admitted, so a config bigger than the budget (legal max: 1,000 keywords ×
// 2 devices = 2,000 units) can never starve.
//
// A free check costs a bounded number of upstream calls per CONFIG (at most a
// few Search Console pages, or one Bing call) no matter how many keywords it
// tracks, so counting keyword/device pairs now over-states the real cost. It is
// kept as the unit because it is still monotonic in tracker size and therefore
// a safe upper bound: it admits fewer configs per tick than the sources could
// serve, never more. Unprocessed configs stay due and the next tick resumes
// oldest-first.
const SCHEDULED_TASK_UNIT_BUDGET = 1000;

// Wall-clock guard for the per-config loop: sub-hourly crons are killed at 15
// minutes, and a large due set walks serially. Stopping early is safe —
// unprocessed configs stay due and the next tick resumes oldest-first.
const TICK_DEADLINE_MS = 3 * 60_000;

// Cap on the per-tick list of configs blocked by an active run. Blocked
// configs leave no durable trace on their row, so the summary names them.
const ALREADY_RUNNING_IDS_CAP = 20;

// Cron body for the `scheduled` Worker handler: start a rank-check run for every
// config that's due. Wrapped in `withPgClient` at the entrypoint (server.ts).
export async function runScheduledRankChecks(env: Env) {
  const nowIso = new Date().toISOString();
  const dueConfigs =
    await RankTrackingRepository.getDueConfigsWithOrganization(nowIso);
  const keywordCounts = await RankTrackingRepository.getKeywordCountsForConfigs(
    dueConfigs.map((config) => config.id),
  );

  const deadline = Date.now() + TICK_DEADLINE_MS;
  let unitsStarted = 0;
  let started = 0;
  let stoppedByBudget = false;
  let stoppedByDeadline = false;
  let skippedNoKeywords = 0;
  let concurrentChangeSkips = 0;
  let alreadyRunning = 0;
  const alreadyRunningConfigIds: string[] = [];
  let workflowStartErrors = 0;
  let configErrors = 0;

  for (const config of dueConfigs) {
    if (Date.now() >= deadline) {
      stoppedByDeadline = true;
      break;
    }
    // Per-config containment: one bad row (e.g. malformed next_check_at, which
    // sorts first and would head every scan) or transient DB error must not
    // starve the rest of the tick or suppress the summary log.
    try {
      const interval = isScheduledRankTrackingInterval(config.scheduleInterval)
        ? config.scheduleInterval
        : null;
      // Unreachable: the due query excludes manual configs and NULL next check
      // times. Narrow rather than assert so a query change can't produce a run
      // with no schedule anchor.
      if (!interval || !config.nextCheckAt) continue;

      const kwCount = keywordCounts.get(config.id) ?? 0;
      const taskUnits = kwCount * devicesCount(config.devices);
      // Projected stop: admit only what fits the budget. The first start of a
      // tick is exempt so an oversized config can never starve, and zero-unit
      // rows (no keywords) always advance.
      if (
        started > 0 &&
        unitsStarted + taskUnits > SCHEDULED_TASK_UNIT_BUDGET
      ) {
        stoppedByBudget = true;
        break;
      }

      const observedNextCheckAt = config.nextCheckAt;
      const nextCheckAt = computeNextCheckAt(interval, observedNextCheckAt);

      if (kwCount === 0) {
        const claimed = await RankTrackingRepository.claimDueConfig({
          configId: config.id,
          projectId: config.projectId,
          observedNextCheckAt,
          nextCheckAt,
          lastSkipReason: "no_keywords",
        });
        if (claimed) skippedNoKeywords++;
        else concurrentChangeSkips++;
        continue;
      }

      // Claim the slot before starting. The workflow writes null on a fully
      // successful run, so clearing lastSkipReason here keeps a stale badge
      // from outliving the condition that set it.
      const claimed = await RankTrackingRepository.claimDueConfig({
        configId: config.id,
        projectId: config.projectId,
        observedNextCheckAt,
        nextCheckAt,
        lastSkipReason: null,
      });
      if (!claimed) {
        concurrentChangeSkips++;
        continue;
      }

      let result;
      try {
        result = await beginRankCheckRun({
          workflow: env.RANK_CHECK_WORKFLOW,
          config,
          projectId: config.projectId,
          billingCustomer: {
            userId: "system",
            userEmail: "",
            organizationId: config.organizationId,
            projectId: config.projectId,
          },
          keywordsTotal: kwCount,
          trigger: "scheduled",
          workflowStartErrorMessage: "Failed to start scheduled workflow",
        });
      } catch (err) {
        // Leave the schedule advanced: a systemic Workflows outage must not
        // make hundreds of configs due again on the next tick.
        workflowStartErrors++;
        console.error(
          `[cron] Failed to start scheduled rank check for config ${config.id} (${config.domain}):`,
          err,
        );
        continue;
      }

      if (result.ok) {
        unitsStarted += taskUnits;
        started++;
        continue;
      }

      alreadyRunning++;
      if (alreadyRunningConfigIds.length < ALREADY_RUNNING_IDS_CAP) {
        alreadyRunningConfigIds.push(config.id);
      }
      // Nothing was started, so give the slot back and retry next tick once the
      // blocking run clears. A manual edit landing in between wins the CAS.
      const restored = await RankTrackingRepository.claimDueConfig({
        configId: config.id,
        projectId: config.projectId,
        observedNextCheckAt: nextCheckAt,
        nextCheckAt: observedNextCheckAt,
      });
      if (!restored) {
        console.log(
          `[cron] Could not restore schedule for config ${config.id} (${config.domain}) — changed concurrently`,
        );
      }
    } catch (err) {
      configErrors++;
      console.error(
        `[cron] Error processing config ${config.id} (${config.domain}):`,
        err,
      );
    }
  }

  // Oldest by the due query's next_check_at ASC ordering.
  const oldestDue = dueConfigs[0]?.nextCheckAt;
  // Object argument (not an interpolated string) so Workers Logs indexes the
  // fields. Error level when anything failed, so ticks that need attention
  // surface in error-filtered views.
  const logSummary =
    workflowStartErrors + configErrors > 0 ? console.error : console.log;
  logSummary({
    event: "rank_tracking_scheduler_summary",
    candidates: dueConfigs.length,
    started,
    unitsStarted,
    budget: SCHEDULED_TASK_UNIT_BUDGET,
    stoppedByBudget,
    stoppedByDeadline,
    skippedNoKeywords,
    concurrentChangeSkips,
    alreadyRunning,
    alreadyRunningConfigIds,
    workflowStartErrors,
    configErrors,
    oldestDueAgeMs: oldestDue
      ? Date.now() - new Date(oldestDue).getTime()
      : null,
  });
}
