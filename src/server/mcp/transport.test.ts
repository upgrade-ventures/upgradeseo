import type { CreateMcpHandlerOptions } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWorkersOAuthMcpProps,
  MCP_AUTH_CONTEXT_PROP,
} from "@/server/mcp/context";
import {
  handleAuthenticatedUpgradeSeoMcpRequest,
  handleSelfHostedUpgradeSeoMcpRequest,
} from "@/server/mcp/transport";

const selfHostedAuthMocks = vi.hoisted(() => ({
  resolveCloudflareAccessContext: vi.fn(),
  resolveLocalNoAuthContext: vi.fn(),
  createUpgradeSeoMcpServer: vi.fn(),
  createMcpHandler: vi.fn(),
}));

vi.mock("@/middleware/ensure-user/cloudflareAccess", () => ({
  resolveCloudflareAccessContext:
    selfHostedAuthMocks.resolveCloudflareAccessContext,
}));

vi.mock("@/middleware/ensure-user/delegated", () => ({
  resolveLocalNoAuthContext: selfHostedAuthMocks.resolveLocalNoAuthContext,
}));

vi.mock("@/lib/auth", () => ({
  getHostedBaseUrl: () => "https://upgradeseo.test",
}));

vi.mock("@/server/mcp/server", () => ({
  createUpgradeSeoMcpServer: (props?: unknown) => {
    selfHostedAuthMocks.createUpgradeSeoMcpServer(props);
    return new McpServer({
      name: "UpgradeSEO MCP",
      title: "UpgradeSEO",
      version: "0.0.11",
      description: "SEO research tools for AI agents",
      websiteUrl: "https://upgradeseo.test",
      icons: [
        {
          src: "https://upgradeseo.test/android-chrome-512x512.png",
          mimeType: "image/png",
          sizes: ["512x512"],
        },
      ],
    });
  },
}));

vi.mock("agents/mcp/server", () => ({
  createMcpHandler: (
    _createServer: () => McpServer,
    options: CreateMcpHandlerOptions,
  ) => {
    selfHostedAuthMocks.createMcpHandler(options);
    return async () => Response.json({ handledBy: "modern" }, { status: 202 });
  },
}));

const ctx: ExecutionContext = {
  waitUntil() {},
  passThroughOnException() {},
  props: {},
};

function createMcpRequest(headers?: Record<string, string>) {
  return new Request("https://upgradeseo.test/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    }),
  });
}

// The modern (2026-07-28) era is selected by the per-request `_meta` envelope
// claim; without it every POST classifies as legacy traffic.
function createModernMcpRequest() {
  return new Request("https://upgradeseo.test/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

function hostedProps(scopes: string[] = ["mcp"]) {
  return createWorkersOAuthMcpProps({
    userId: "user-1",
    userEmail: "user@example.com",
    organizationId: "org-1",
    baseUrl: "https://upgradeseo.test",
    clientId: "client-1",
    scopes,
  });
}

describe("handleSelfHostedUpgradeSeoMcpRequest", () => {
  beforeEach(() => {
    selfHostedAuthMocks.resolveLocalNoAuthContext.mockResolvedValue({
      userId: "local-admin",
      userEmail: "admin@localhost",
      organizationId: "delegated-local-admin",
    });
    selfHostedAuthMocks.resolveCloudflareAccessContext.mockResolvedValue({
      userId: "cloudflare-user",
      userEmail: "person@example.com",
      organizationId: "delegated-cloudflare-user",
    });
  });

  it("accepts local no-auth MCP requests with the local admin context", async () => {
    const response = await handleSelfHostedUpgradeSeoMcpRequest(
      createMcpRequest(),
      "local_noauth",
      {},
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("connection")).not.toBe("keep-alive");
    expect(selfHostedAuthMocks.resolveLocalNoAuthContext).toHaveBeenCalled();
    expect(selfHostedAuthMocks.createUpgradeSeoMcpServer).toHaveBeenCalledWith({
      [MCP_AUTH_CONTEXT_PROP]: {
        userId: "local-admin",
        userEmail: "admin@localhost",
        organizationId: "delegated-local-admin",
        baseUrl: "https://upgradeseo.test",
      },
    });
    // Self-hosted must not pin Origins to the request's own Host — the
    // handler's localhost-class default is the rebinding-safe choice.
    expect(selfHostedAuthMocks.createMcpHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedOriginHostnames: undefined,
        legacy: "reject",
      }),
    );
  });

  it("accepts Cloudflare Access MCP requests through the existing Access resolver", async () => {
    const response = await handleSelfHostedUpgradeSeoMcpRequest(
      createMcpRequest(),
      "cloudflare_access",
      {},
      ctx,
    );

    expect(response.status).toBe(200);
    expect(
      selfHostedAuthMocks.resolveCloudflareAccessContext,
    ).toHaveBeenCalledWith(expect.any(Headers));
    expect(selfHostedAuthMocks.createUpgradeSeoMcpServer).toHaveBeenCalledWith({
      [MCP_AUTH_CONTEXT_PROP]: {
        userId: "cloudflare-user",
        userEmail: "person@example.com",
        organizationId: "delegated-cloudflare-user",
        baseUrl: "https://upgradeseo.test",
      },
    });
  });

  it("answers OPTIONS preflight without resolving an auth context", async () => {
    const response = await handleSelfHostedUpgradeSeoMcpRequest(
      new Request("https://upgradeseo.test/mcp", { method: "OPTIONS" }),
      "cloudflare_access",
      {},
      ctx,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(
      selfHostedAuthMocks.resolveCloudflareAccessContext,
    ).not.toHaveBeenCalled();
    expect(
      selfHostedAuthMocks.createUpgradeSeoMcpServer,
    ).not.toHaveBeenCalled();
  });
});

describe("handleAuthenticatedUpgradeSeoMcpRequest", () => {
  it("accepts the provider's encrypted identity and MCP scope fallback", async () => {
    const props = hostedProps();

    const response = await handleAuthenticatedUpgradeSeoMcpRequest(
      createMcpRequest(),
      props,
      {},
      { ...ctx, props },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("connection")).not.toBe("keep-alive");
    expect(selfHostedAuthMocks.createMcpHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedOriginHostnames: ["upgradeseo.test"],
        legacy: "reject",
      }),
    );
    expect(selfHostedAuthMocks.createUpgradeSeoMcpServer).toHaveBeenCalledWith(
      props,
    );
  });

  it("routes modern-era requests to the SDK handler", async () => {
    const props = hostedProps();

    const response = await handleAuthenticatedUpgradeSeoMcpRequest(
      createModernMcpRequest(),
      props,
      {},
      { ...ctx, props },
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ handledBy: "modern" });
    // The modern handler owns server construction; the legacy leg must not
    // have built one.
    expect(
      selfHostedAuthMocks.createUpgradeSeoMcpServer,
    ).not.toHaveBeenCalled();
  });

  it("rejects a legacy request from a disallowed Origin", async () => {
    const props = hostedProps();

    const response = await handleAuthenticatedUpgradeSeoMcpRequest(
      createMcpRequest({ Origin: "https://evil.com" }),
      props,
      {},
      { ...ctx, props },
    );

    expect(response.status).toBe(403);
    expect(
      selfHostedAuthMocks.createUpgradeSeoMcpServer,
    ).not.toHaveBeenCalled();
  });

  it("rejects provider props missing the OAuth client identity", async () => {
    // Hosted tokens always carry clientId/scopes; a token without them must
    // fail closed rather than skip scope enforcement.
    const props = createWorkersOAuthMcpProps({
      userId: "user-1",
      userEmail: "user@example.com",
      organizationId: "org-1",
      baseUrl: "https://upgradeseo.test",
    });

    const response = await handleAuthenticatedUpgradeSeoMcpRequest(
      createMcpRequest(),
      props,
      {},
      { ...ctx, props },
    );

    expect(response.status).toBe(403);
  });

  it("rejects an OAuth client without the MCP scope", async () => {
    const props = hostedProps(["offline_access"]);

    const response = await handleAuthenticatedUpgradeSeoMcpRequest(
      createMcpRequest(),
      props,
      {},
      { ...ctx, props },
    );

    expect(response.status).toBe(403);
  });
});
