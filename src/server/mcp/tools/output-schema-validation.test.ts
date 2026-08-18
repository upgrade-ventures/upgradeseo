import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import { objectSchema } from "@/server/mcp/output-schemas";
import { getBacklinksProfileTool } from "./get-backlinks-profile";
import { makeToolContext } from "./tool-test-support";

const mocks = vi.hoisted(() => ({
  getProjectForOrganization: vi.fn(),
  profileBacklinksPage: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {},
}));

vi.mock("@/server/features/projects/services/ProjectService", () => ({
  ProjectService: {
    getProjectForOrganization: mocks.getProjectForOrganization,
  },
}));

vi.mock("@/server/features/backlinks/services/BacklinksService", () => ({
  BacklinksService: {
    profileBacklinksPage: mocks.profileBacklinksPage,
  },
}));

const toolContext = makeToolContext({
  userEmail: "team@example.com",
  baseUrl: "https://app.example.com",
});

const backlinkPage = {
  rows: [
    {
      domainFrom: "source.example",
      urlFrom: "https://source.example/post",
      urlTo: "https://example.com/",
      anchor: "Example",
      itemType: "content",
      isDofollow: true,
      relAttributes: ["noopener"],
      rank: 77,
      domainFromRank: 65,
      pageFromRank: 54,
      spamScore: 3,
      firstSeen: "2026-01-01",
      lastSeen: "2026-03-01",
      isLost: false,
      isBroken: false,
      linksCount: 1,
    },
  ],
  totalCount: 450,
  hasMore: true,
  page: 2,
  pageSize: 50,
  fetchedAt: "2026-06-25T00:00:00.000Z",
};

beforeEach(() => {
  mocks.getProjectForOrganization.mockResolvedValue({
    id: "project_123",
    locationCode: 2840,
    languageCode: "en",
  });
});

describe("MCP tool output schemas", () => {
  it("get_backlinks_profile accepts a paginated backlinks profile payload", async () => {
    const schema = objectSchema(getBacklinksProfileTool.config.outputSchema);

    const result = await schema.safeParseAsync({
      backlinks: backlinkPage,
      meta: {
        organizationId: "org_123",
        projectId: "project_123",
        url: "https://app.example.com/p/project_123/backlinks",
      },
    });

    expect(result.success).toBe(true);
  });
});

describe("get_backlinks_profile MCP tool", () => {
  it("returns paginated backlink rows and honors filters, sorting, and mode", async () => {
    mocks.profileBacklinksPage.mockResolvedValue(backlinkPage);

    const result = await getBacklinksProfileTool.handler(
      {
        projectId: "project_123",
        target: "example.com",
        scope: "domain",
        page: 2,
        pageSize: 50,
        sortField: "spamScore",
        sortOrder: "asc",
        filters: {
          include: "blog",
          linkType: "nofollow",
          hideLost: true,
        },
        mode: "as_is",
      },
      toolContext,
    );

    expect(mocks.profileBacklinksPage).toHaveBeenCalledWith(
      {
        target: "example.com",
        scope: "domain",
        page: 2,
        pageSize: 50,
        sortField: "spamScore",
        sortOrder: "asc",
        filters: {
          include: "blog",
          linkType: "nofollow",
          hideLost: true,
        },
        mode: "as_is",
      },
      {
        userId: "user_123",
        userEmail: "team@example.com",
        organizationId: "org_123",
        projectId: "project_123",
      },
    );
    expect(result.structuredContent?.backlinks).toEqual(backlinkPage);
    const first = result.content[0];
    expect(first.type === "text" && first.text).toContain("- has more: yes");
  });

  it("passes through final-page pagination state", async () => {
    const finalPage = {
      ...backlinkPage,
      totalCount: 51,
      hasMore: false,
      page: 2,
    };
    mocks.profileBacklinksPage.mockResolvedValue(finalPage);

    const result = await getBacklinksProfileTool.handler(
      {
        projectId: "project_123",
        target: "example.com",
        scope: "domain",
        page: 2,
        pageSize: 50,
        sortField: "rank",
        sortOrder: "desc",
        filters: {},
        mode: "one_per_domain",
      },
      toolContext,
    );

    expect(result.structuredContent?.backlinks).toMatchObject({
      totalCount: 51,
      hasMore: false,
      page: 2,
      pageSize: 50,
    });
  });

  // The message names which free source to connect, so the tool must surface
  // the service's error intact instead of collapsing it to an empty page.
  it("preserves the service's missing-data-source error", async () => {
    const error = new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      "Verify this site in Bing Webmaster Tools to see its individual links.",
    );
    mocks.profileBacklinksPage.mockRejectedValue(error);

    await expect(
      getBacklinksProfileTool.handler(
        {
          projectId: "project_123",
          target: "example.com",
          scope: "domain",
          page: 1,
          pageSize: 100,
          sortField: "rank",
          sortOrder: "desc",
          filters: {},
          mode: "one_per_domain",
        },
        toolContext,
      ),
    ).rejects.toMatchObject({
      code: "DATA_SOURCE_NOT_CONFIGURED",
      message:
        "Verify this site in Bing Webmaster Tools to see its individual links.",
    });
  });
});
