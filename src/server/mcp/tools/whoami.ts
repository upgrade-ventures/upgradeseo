import { mcpResponse } from "@/server/mcp/formatters";
import { type ToolContext } from "@/server/mcp/context";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import { optionalMetaOutputSchema } from "@/server/mcp/output-schemas";
import { z } from "zod";

export const whoamiTool = {
  name: "whoami",
  config: {
    title: "Who am I",
    description:
      "Returns the authenticated user, organization, server mode, and token scopes. Use this first to confirm connection context before choosing a project.",
    inputSchema: {} as Record<string, never>,
    outputSchema: {
      userId: z.string(),
      userEmail: z.string(),
      organizationId: z.string(),
      scopes: z.array(z.string()),
      mode: z.enum(["hosted", "self-hosted"]),
      ...optionalMetaOutputSchema,
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: async (_args: Record<string, never>, context: ToolContext) => {
    const auth = context.auth;
    const isHosted = await isHostedServerAuthMode();
    const lines = [
      `User: ${auth.userId} (${auth.userEmail})`,
      `Organization: ${auth.organizationId}`,
      `Mode: ${isHosted ? "hosted" : "self-hosted"}`,
      `Scopes: ${auth.scopes.length > 0 ? auth.scopes.join(", ") : "none"}`,
    ];
    return mcpResponse({
      text: lines.join("\n"),
      meta: {
        organizationId: auth.organizationId,
      },
      structuredContent: {
        userId: auth.userId,
        userEmail: auth.userEmail,
        organizationId: auth.organizationId,
        scopes: auth.scopes,
        mode: isHosted ? "hosted" : "self-hosted",
      },
    });
  },
};
