import { beforeEach, describe, expect, it, vi } from "vitest";
import { RankTrackingService } from "./RankTrackingService";

const mocks = vi.hoisted(() => ({
  getConfigById: vi.fn(),
  getKeywordsForConfig: vi.fn(),
  addKeywordsToConfig: vi.fn(),
  removeKeywordsFromConfig: vi.fn(),
  getKeywordCountForConfig: vi.fn(),
  isHostedServerAuthMode: vi.fn(),
  customerHasPaidPlan: vi.fn(),
  runFreeRankCheck: vi.fn(),
  recordFreeRankCheck: vi.fn(),
  fetchFreeTrackedKeywordMetrics: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock(
  "@/server/features/rank-tracking/repositories/RankTrackingRepository",
  () => ({ RankTrackingRepository: mocks }),
);
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: mocks.isHostedServerAuthMode,
}));
vi.mock("@/server/auth/organizationContext", () => ({
  customerHasPaidPlan: mocks.customerHasPaidPlan,
}));
vi.mock("@/server/features/rank-tracking/services/rankCheckRunGuards", () => ({
  reconcileActiveRankCheckRun: vi.fn(),
}));
vi.mock("./recordFreeRankCheck", () => ({
  recordFreeRankCheck: mocks.recordFreeRankCheck,
  fetchFreeTrackedKeywordMetrics: mocks.fetchFreeTrackedKeywordMetrics,
}));
vi.mock("./freeRankSource", () => ({
  runFreeRankCheck: mocks.runFreeRankCheck,
  recordFreeRankCheck: mocks.recordFreeRankCheck,
  fetchFreeTrackedKeywordMetrics: mocks.fetchFreeTrackedKeywordMetrics,
}));

const config = {
  id: "config_1",
  projectId: "project_1",
  domain: "example.com",
  locationCode: 2840,
  languageCode: "en",
  locationName: null,
  devices: "both" as const,
  serpDepth: 10,
  scheduleInterval: "weekly" as const,
};

const billingCustomer = {
  userId: "user_1",
  userEmail: "user@example.com",
  organizationId: "org_1",
  projectId: "project_1",
};

describe("RankTrackingService management invariants", () => {
  beforeEach(() => {
    mocks.getConfigById.mockResolvedValue(config);
    mocks.getKeywordsForConfig.mockResolvedValue([
      { id: "kw_1", keyword: "seo" },
      { id: "kw_2", keyword: "audit" },
    ]);
  });

  it("reports only keyword rows actually inserted", async () => {
    mocks.getKeywordsForConfig.mockResolvedValue([]);
    mocks.addKeywordsToConfig.mockImplementation(
      async (rows: Array<{ id: string }>) => [rows[0]?.id],
    );

    const result = await RankTrackingService.addKeywords(
      "config_1",
      "project_1",
      ["SEO", "seo", "technical seo"],
    );

    expect(result).toMatchObject({ added: 1 });
    expect(result.addedIds).toHaveLength(1);
    expect(mocks.addKeywordsToConfig).toHaveBeenCalledWith([
      expect.objectContaining({ keyword: "seo" }),
      expect.objectContaining({ keyword: "technical seo" }),
    ]);
  });

  it("adds keywords to a manual tracker without a extra count read", async () => {
    mocks.getConfigById.mockResolvedValue({
      ...config,
      scheduleInterval: "manual",
    });
    mocks.getKeywordsForConfig.mockResolvedValue([]);
    mocks.addKeywordsToConfig.mockImplementation(
      async (rows: Array<{ id: string }>) => rows.map((row) => row.id),
    );

    await expect(
      RankTrackingService.addKeywords("config_1", "project_1", ["seo"]),
    ).resolves.toMatchObject({ added: 1 });
    expect(mocks.getKeywordCountForConfig).not.toHaveBeenCalled();
  });

  it("deduplicates removal IDs and reports only owned rows deleted", async () => {
    mocks.removeKeywordsFromConfig.mockResolvedValue(["owned_id"]);

    const result = await RankTrackingService.removeKeywords(
      "config_1",
      "project_1",
      ["owned_id", "foreign_id", "missing_id", "owned_id"],
    );

    expect(mocks.removeKeywordsFromConfig).toHaveBeenCalledWith(
      ["owned_id", "foreign_id", "missing_id"],
      "config_1",
    );
    expect(result).toEqual({ removed: 1, removedIds: ["owned_id"] });
  });

  it("allows paid hosted and self-hosted runs", async () => {
    mocks.runFreeRankCheck.mockResolvedValue({
      source: "gsc_average_position",
      notice: "Google positions from Search Console.",
      rows: [],
      keywordsChecked: 0,
    });
    mocks.recordFreeRankCheck.mockResolvedValue({ ok: true, runId: "run_1" });

    mocks.isHostedServerAuthMode.mockResolvedValue(true);
    mocks.customerHasPaidPlan.mockResolvedValue(true);
    await expect(
      RankTrackingService.triggerCheck({
        configId: "config_1",
        projectId: "project_1",
        billingCustomer,
      }),
    ).resolves.toEqual({ ok: true, runId: "run_1" });

    mocks.isHostedServerAuthMode.mockResolvedValue(false);
    // Isolate the second half of this test so it proves self-hosted mode skips
    // the hosted billing lookup.
    mocks.customerHasPaidPlan.mockClear();
    await expect(
      RankTrackingService.triggerCheck({
        configId: "config_1",
        projectId: "project_1",
        billingCustomer,
      }),
    ).resolves.toEqual({ ok: true, runId: "run_1" });
    expect(mocks.customerHasPaidPlan).not.toHaveBeenCalled();
  });

  // A check the free sources cannot answer must say so. Recording an empty run
  // would render as "you rank nowhere".
  it("refuses a check no free source can answer", async () => {
    mocks.runFreeRankCheck.mockResolvedValue(null);

    await expect(
      RankTrackingService.triggerCheck({
        configId: "config_1",
        projectId: "project_1",
        billingCustomer,
      }),
    ).rejects.toMatchObject({ code: "DATA_SOURCE_NOT_CONFIGURED" });
    expect(mocks.recordFreeRankCheck).not.toHaveBeenCalled();
  });

  it("allows self-hosted metrics refresh without a plan check", async () => {
    mocks.isHostedServerAuthMode.mockResolvedValue(false);
    mocks.fetchFreeTrackedKeywordMetrics.mockResolvedValue([]);

    await expect(
      RankTrackingService.refreshKeywordMetrics(
        "config_1",
        "project_1",
        billingCustomer,
      ),
    ).resolves.toEqual({ updated: 0 });
    expect(mocks.customerHasPaidPlan).not.toHaveBeenCalled();
    expect(mocks.fetchFreeTrackedKeywordMetrics).toHaveBeenCalledTimes(1);
  });

  it("rejects missing or foreign trackers with NOT_FOUND before mutation", async () => {
    mocks.getConfigById.mockResolvedValue(null);

    await expect(
      RankTrackingService.removeKeywords("foreign", "project_1", ["kw_1"]),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.removeKeywordsFromConfig).not.toHaveBeenCalled();
  });
});
