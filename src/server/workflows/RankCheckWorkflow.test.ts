import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowStep } from "cloudflare:workers";
import { RankCheckWorkflow } from "./RankCheckWorkflow";

const mocks = vi.hoisted(() => ({
  getConfigById: vi.fn(),
  getRunById: vi.fn(),
  getKeywordsForConfig: vi.fn(),
  getSnapshotsForRun: vi.fn(),
  insertSnapshots: vi.fn(),
  updateRun: vi.fn(),
  updateConfig: vi.fn(),
  runFreeRankCheck: vi.fn(),
  failRunIfActive: vi.fn(),
  captureServerEvent: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  WorkflowEntrypoint: vi.fn(),
}));
vi.mock("cloudflare:workflows", () => ({
  NonRetryableError: class extends Error {},
}));
vi.mock("@/db", () => ({ withPgClient: (fn: () => unknown) => fn() }));
vi.mock(
  "@/server/features/rank-tracking/repositories/RankTrackingRepository",
  () => ({ RankTrackingRepository: mocks }),
);
vi.mock("@/server/features/rank-tracking/services/rankCheckRunGuards", () => ({
  failRunIfActive: mocks.failRunIfActive,
}));
vi.mock("@/server/features/rank-tracking/services/freeRankSource", () => ({
  runFreeRankCheck: mocks.runFreeRankCheck,
}));
vi.mock("@/server/workflows/pgStep", () => ({
  pgStep: (
    _step: unknown,
    _name: string,
    _config: unknown,
    fn: () => unknown,
  ) => fn(),
}));
vi.mock("@/server/lib/posthog", () => ({
  captureServerEvent: mocks.captureServerEvent,
}));

const payload = {
  runId: "run_1",
  configId: "config_1",
  billingCustomer: {
    userId: "user_1",
    userEmail: "user@example.com",
    organizationId: "org_1",
    projectId: "project_1",
  },
  projectId: "project_1",
  domain: "example.com",
  locationCode: 2840,
  devices: "desktop" as const,
  trigger: "scheduled" as const,
  languageCode: "en",
  serpDepth: 10,
};

function runWorkflow() {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the mocked base class does not inspect Worker constructor context
  const workflow = new RankCheckWorkflow({} as ExecutionContext, {} as Env);
  return workflow.run(
    { instanceId: "run_1", timestamp: new Date(), payload },
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- workflow steps are executed directly by the pgStep mock
    {} as WorkflowStep,
  );
}

describe("RankCheckWorkflow", () => {
  beforeEach(() => {
    mocks.getConfigById.mockResolvedValue({ isActive: true });
    mocks.getRunById.mockResolvedValue({
      id: "run_1",
      status: "running",
      keywordsTotal: 1,
    });
    mocks.getKeywordsForConfig.mockResolvedValue([
      { id: "kw_1", keyword: "seo" },
    ]);
    mocks.getSnapshotsForRun.mockResolvedValue([{ trackingKeywordId: "kw_1" }]);
  });

  // The run's free-text channel is the only place the source label can live, so
  // losing it would let a Search Console window average be read as a live SERP
  // position.
  it("completes the run carrying the source notice", async () => {
    mocks.runFreeRankCheck.mockResolvedValue({
      source: "gsc_average_position",
      notice: "Google positions from Search Console, averaged over 28 days.",
      rows: [
        {
          trackingKeywordId: "kw_1",
          keyword: "seo",
          device: "desktop",
          position: 4,
          url: "https://example.com/",
        },
      ],
      keywordsChecked: 1,
    });

    await runWorkflow();

    expect(mocks.insertSnapshots).toHaveBeenCalledWith([
      expect.objectContaining({ runId: "run_1", serpFeatures: null }),
    ]);
    expect(mocks.updateRun).toHaveBeenCalledWith(
      "run_1",
      expect.objectContaining({
        status: "completed",
        keywordsChecked: 1,
        errorMessage:
          "Google positions from Search Console, averaged over 28 days.",
      }),
    );
  });

  it("fails the run when no free source can answer", async () => {
    mocks.runFreeRankCheck.mockRejectedValue(
      new Error("Bing Webmaster Tools could not read example.com"),
    );

    await expect(runWorkflow()).rejects.toThrow();

    expect(mocks.insertSnapshots).not.toHaveBeenCalled();
    expect(mocks.failRunIfActive).toHaveBeenCalledWith(
      "run_1",
      "Bing Webmaster Tools could not read example.com",
    );
  });
});
