import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pin the suite to a root mount. VITE_BASE_PATH is a per-deploy value, and
    // with it set in .env the MCP route and both OAuth callback paths pick up
    // the prefix, so tests asserting "/mcp" or "/api/gsc/oauth/callback" fail
    // on a developer machine configured for the sub-path deploy and pass in
    // CI. The prefix is a deployment concern and is verified against a running
    // server, not here.
    env: { VITE_BASE_PATH: "" },
    restoreMocks: true,
    clearMocks: true,
    server: {
      deps: {
        // Processed by vitest (instead of loaded natively by node) so the
        // oauth-refresh e2e test's cloudflare:workers mock reaches the real
        // provider module.
        inline: ["@cloudflare/workers-oauth-provider"],
      },
    },
  },
});
