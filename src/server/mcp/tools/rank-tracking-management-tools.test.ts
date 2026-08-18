import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { addRankTrackingKeywordsTool } from "./add-rank-tracking-keywords";
import { createRankTrackerTool } from "./create-rank-tracker";
import { removeRankTrackingKeywordsTool } from "./remove-rank-tracking-keywords";
import { runRankTrackerTool } from "./run-rank-tracker";
import { makeToolContext, textContent } from "./tool-test-support";

const mocks = vi.hoisted(() => ({
  getProjectForOrganization: vi.fn(),
  createConfig: vi.fn(),
  getTracker: vi.fn(),
  addKeywords: vi.fn(),
  removeKeywords: vi.fn(),
  estimateCost: vi.fn(),
  triggerCheck: vi.fn(),
  captureServerEvent: vi.fn(),
  waitUntil: vi.fn((promise: Promise<unknown>) => void promise.catch(() => {})),
}));

vi.mock("cloudflare:workers", () => ({
  env: {},
  waitUntil: mocks.waitUntil,
}));
vi.mock("@/server/features/projects/services/ProjectService", () => ({
  ProjectService: {
    getProjectForOrganization: mocks.getProjectForOrganization,
  },
}));
vi.mock("@/server/features/rank-tracking/services/RankTrackingService", () => ({
  RankTrackingService: {
    createConfig: mocks.createConfig,
    getTracker: mocks.getTracker,
    addKeywords: mocks.addKeywords,
    removeKeywords: mocks.removeKeywords,
    estimateCost: mocks.estimateCost,
    triggerCheck: mocks.triggerCheck,
  },
}));
vi.mock("@/server/lib/posthog", () => ({
  captureServerEvent: mocks.captureServerEvent,
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const trackerId = "22222222-2222-4222-8222-222222222222";
const keywordId = "33333333-3333-4333-8333-333333333333";

const toolContext = makeToolContext();

const createdConfig = {
  id: trackerId,
  projectId,
  domain: "upgradeseo.test",
  locationCode: 2840,
  languageCode: "en",
  locationName: null,
  devices: "mobile" as const,
  serpDepth: 40,
  scheduleInterval: "manual" as const,
  isActive: true,
};

describe("rank tracking management MCP tools", () => {
  beforeEach(() => {
    mocks.getProjectForOrganization.mockResolvedValue({
      id: projectId,
      domain: "upgradeseo.test",
      locationCode: 2840,
      languageCode: "en",
    });
    mocks.captureServerEvent.mockResolvedValue(undefined);
  });

  it("creates a manual tracker from project defaults without spending credits", async () => {
    mocks.createConfig.mockResolvedValue(createdConfig);

    const parsed = z.object(createRankTrackerTool.config.inputSchema).parse({
      projectId,
    });
    const result = await createRankTrackerTool.handler(parsed, toolContext);

    expect(mocks.createConfig).toHaveBeenCalledWith({
      projectId,
      projectMarket: {
        id: projectId,
        domain: "upgradeseo.test",
        locationCode: 2840,
        languageCode: "en",
      },
      domain: "upgradeseo.test",
      locationCode: undefined,
      languageCode: undefined,
      locationName: undefined,
      devices: "mobile",
      serpDepth: 40,
      scheduleInterval: "manual",
    });
    expect(textContent(result)).toContain("no check was started");
    expect(result.structuredContent).toMatchObject({
      trackerId,
      config: createdConfig,
    });
    expect(mocks.getTracker).not.toHaveBeenCalled();
    expect(mocks.captureServerEvent).toHaveBeenCalledWith({
      distinctId: "user_123",
      event: "rank_tracking:config_create",
      organizationId: "org_123",
      properties: {
        project_id: projectId,
        domain: "upgradeseo.test",
        devices: "mobile",
        schedule: "manual",
        source: "mcp",
      },
    });
    expect(
      createRankTrackerTool.config.outputSchema.safeParse(
        result.structuredContent,
      ).success,
    ).toBe(true);
  });

  it("rejects tracker creation when neither the call nor project has a domain", async () => {
    mocks.getProjectForOrganization.mockResolvedValue({
      id: projectId,
      domain: null,
      locationCode: 2840,
      languageCode: "en",
    });

    await expect(
      createRankTrackerTool.handler({ projectId }, toolContext),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mocks.createConfig).not.toHaveBeenCalled();
  });

  it("reports database-confirmed add and removal counts in text and structured output", async () => {
    mocks.addKeywords.mockResolvedValue({ added: 1, addedIds: [keywordId] });
    mocks.removeKeywords.mockResolvedValue({
      removed: 1,
      removedIds: [keywordId],
    });

    const added = await addRankTrackingKeywordsTool.handler(
      { projectId, trackerId, keywords: ["seo", "SEO", "existing"] },
      toolContext,
    );
    expect(textContent(added)).toContain("Added 1 of 3 requested");
    expect(added.structuredContent).toMatchObject({ requested: 3, added: 1 });
    expect(mocks.addKeywords).toHaveBeenCalledWith(trackerId, projectId, [
      "seo",
      "SEO",
      "existing",
    ]);

    const removed = await removeRankTrackingKeywordsTool.handler(
      { projectId, trackerId, keywordIds: [keywordId, keywordId] },
      toolContext,
    );
    expect(textContent(removed)).toContain("Removed 1 of 2 requested");
    expect(removed.structuredContent).toMatchObject({
      requested: 2,
      removed: 1,
      removedIds: [keywordId],
    });
  });

  it("returns the created run ID and emits the existing telemetry contract", async () => {
    mocks.triggerCheck.mockResolvedValue({
      ok: true,
      runId: "run_1",
    });
    const result = await runRankTrackerTool.handler(
      { projectId, trackerId },
      toolContext,
    );

    expect(result.structuredContent).toMatchObject({
      started: true,
      runId: "run_1",
    });
    expect(mocks.triggerCheck).toHaveBeenCalledWith({
      configId: trackerId,
      projectId,
      billingCustomer: {
        organizationId: "org_123",
        projectId,
        userEmail: "alice@example.com",
        userId: "user_123",
      },
    });
    expect(mocks.captureServerEvent).toHaveBeenCalledWith({
      distinctId: "user_123",
      event: "rank_tracking:check_trigger",
      organizationId: "org_123",
      properties: {
        project_id: projectId,
        config_id: trackerId,
        run_id: "run_1",
        source: "mcp",
      },
    });
    expect(mocks.waitUntil).toHaveBeenCalledTimes(1);
  });

  it("does not emit telemetry or imply another charge for an active run", async () => {
    mocks.triggerCheck.mockResolvedValue({
      ok: false,
      reason: "already_running",
      blockingRunId: "run_0",
    });
    const result = await runRankTrackerTool.handler(
      { projectId, trackerId },
      toolContext,
    );

    expect(textContent(result)).toContain("no additional check was charged");
    expect(result.structuredContent).toMatchObject({
      started: false,
      blockingRunId: "run_0",
    });
    expect(mocks.captureServerEvent).not.toHaveBeenCalled();
  });

  it("returns a started run even when deferred telemetry rejects", async () => {
    mocks.triggerCheck.mockResolvedValue({
      ok: true,
      runId: "run_1",
    });
    mocks.captureServerEvent.mockRejectedValue(new Error("telemetry down"));

    await expect(
      runRankTrackerTool.handler({ projectId, trackerId }, toolContext),
    ).resolves.toMatchObject({
      structuredContent: { started: true, runId: "run_1" },
    });
  });
});
