import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/client/components/icons/IconSprite";
import {
  Card,
  InfoNote,
  PageHeaderBand,
  ScreenBody,
  SectionHeader,
} from "@/client/components/prominence/Primitives";
import { ClaudeIcon, CodexIcon } from "@/client/features/ai-mcp/AgentIcons";
import { AvailableTools } from "@/client/features/ai-mcp/AvailableTools";
import {
  CodeBlock,
  Collapsible,
  CopyButton,
} from "@/client/features/ai-mcp/SetupControls";
import { captureClientEvent } from "@/client/lib/posthog";
import { useShellBreakpoint } from "@/client/layout/useShellBreakpoint";
import { getAuthMode, isHostedClientAuthMode } from "@/lib/auth-mode";

const DISCORD_URL = "https://discord.gg/c9uGs3cFXr";
const SKILL_NAMES = [
  "seo-project-setup",
  "seo-coach",
  "keyword-research",
  "keyword-clustering",
  "competitive-landscape",
  "competitor-analysis",
  "link-prospecting",
];
// `YOUR_GITHUB_ORG` is the placeholder this repository uses everywhere for the
// org that hosts your own checkout (README, web/content/docs). It is left in
// deliberately: naming a real org here would be inventing one.
const SKILLS_INSTALL = `npx skills add YOUR_GITHUB_ORG/upgradeseo`;
const ALL_SKILLS_INSTALL = `npx skills add YOUR_GITHUB_ORG/upgradeseo --skill '*'`;
const CLAUDE_CODE_SKILLS_INSTALL = `npx skills add YOUR_GITHUB_ORG/upgradeseo --skill '*' --agent claude-code`;
const CODEX_SKILLS_INSTALL = `npx skills add YOUR_GITHUB_ORG/upgradeseo --skill '*' --agent codex`;
// The clone line matches the one in web/content/docs/self-hosting/cloudflare.md.
// It previously read a bare `git clone` with nothing after it, which fails the
// moment anyone copies it.
const SKILLS_MANUAL_INSTALL = `git clone https://github.com/YOUR_GITHUB_USER/upgradeseo.git

# Codex
mkdir -p ~/.codex/skills
cp -R upgradeseo/.agents/skills/* ~/.codex/skills/

# Claude Code
mkdir -p ~/.claude/skills
cp -R upgradeseo/.agents/skills/* ~/.claude/skills/`;

export const Route = createFileRoute("/_app/ai")({
  component: AiPage,
});

function AiPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  // Measured on this screen's own column rather than the viewport: what decides
  // whether a copy target needs to be 44px is how much room the content has,
  // and the sidebar takes 232px of it.
  const { narrow } = useShellBreakpoint(rootRef);
  // Read after mount rather than during render: the origin is not knowable on
  // the server, and rendering an empty URL then swapping it is a hydration
  // mismatch as well as a moment of wrong instructions on screen.
  const [mcpUrl, setMcpUrl] = useState("");
  useEffect(() => setMcpUrl(`${window.location.origin}/mcp`), []);

  const behindAccess =
    getAuthMode(import.meta.env.AUTH_MODE) === "cloudflare_access";

  return (
    <div ref={rootRef} style={{ paddingBottom: 56 }}>
      <PageHeaderBand
        title="AI & MCP"
        subtitle="Connect your AI agent to UpgradeSEO. Keyword research, SERP checks, domain lookups, backlinks and site audits, from your editor or your chat window."
        tabs={<div aria-hidden style={{ height: 14 }} />}
      />

      <ScreenBody
        style={{ maxWidth: 900, display: "grid", gap: 26, paddingBottom: 8 }}
      >
        {behindAccess ? (
          <div
            role="status"
            style={{
              display: "flex",
              gap: 8,
              padding: "9px 11px",
              border: "1px solid var(--warning-border)",
              background: "var(--warning-soft)",
              borderRadius: 6,
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            <Icon
              name="i-alert"
              size={15}
              style={{ color: "var(--warning)", marginTop: 1 }}
            />
            <div>
              <strong style={{ color: "var(--text)", fontWeight: 600 }}>
                This instance sits behind Cloudflare Access.
              </strong>{" "}
              MCP clients cannot reach it until Managed OAuth is turned on for
              the Access application that fronts this hostname. Everything below
              still applies once it is.
            </div>
          </div>
        ) : null}

        <section>
          <SectionHeader title="MCP server URL" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "var(--subtle)",
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                color: mcpUrl ? "var(--text)" : "var(--text-3)",
                overflowWrap: "anywhere",
              }}
            >
              {mcpUrl || "Reading this instance's address…"}
            </span>
            {mcpUrl ? (
              <CopyButton
                value={mcpUrl}
                successMessage="MCP URL copied"
                label="Copy the MCP server URL"
                narrow={narrow}
                onCopy={() => captureClientEvent("mcp:setup_url_copy")}
              />
            ) : null}
          </div>
          <InfoNote>
            Paste this into any MCP client. It points at the UpgradeSEO instance
            you are using right now, hosted or self-hosted, and you sign in with
            UpgradeSEO when prompted.
          </InfoNote>
          {isHostedClientAuthMode() ? (
            <InfoNote>
              For headless or CI setups, use an API key from{" "}
              <Link to="/settings">Settings</Link> instead of the browser login.
            </InfoNote>
          ) : null}
        </section>

        <section>
          <SectionHeader title="Setup guides" />
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            Pick your agent. Each one takes the URL above.
          </p>
          {mcpUrl ? (
            <SetupGuides mcpUrl={mcpUrl} narrow={narrow} />
          ) : (
            <p style={{ ...BODY, margin: 0 }}>
              The commands appear once this instance's address is known.
            </p>
          )}
        </section>

        <SkillsAndTools narrow={narrow} />
      </ScreenBody>
    </div>
  );
}

/** One card, one entry per agent. Split out of `AiPage` to keep it readable. */
function SetupGuides({ mcpUrl, narrow }: { mcpUrl: string; narrow: boolean }) {
  return (
    <Card>
      <Collapsible
        id="claude-code"
        title="Claude Code"
        subtitle="Add it with the CLI"
        icon={<ClaudeIcon width={16} height={16} />}
        narrow={narrow}
      >
        <p style={BODY}>Run this in your terminal:</p>
        <CodeBlock
          code={`claude mcp add --transport http --scope user upgradeseo ${mcpUrl}`}
          narrow={narrow}
          onCopy={() =>
            captureClientEvent("mcp:setup_command_copy", {
              agent: "claude-code",
            })
          }
        />
        <p style={BODY}>Approve the login when it prompts you.</p>
      </Collapsible>

      <Collapsible
        id="claude-desktop"
        title="Claude Desktop"
        subtitle="Add a custom connector"
        icon={<ClaudeIcon width={16} height={16} />}
        narrow={narrow}
      >
        <ol style={STEPS}>
          <li>Open Settings, then Connectors.</li>
          <li>Choose Add custom connector.</li>
          <li>Paste the MCP URL above and choose Add.</li>
          <li>Approve the UpgradeSEO login when it prompts you.</li>
          <li>
            Optional: once it connects, choose Configure, then Always Approved,
            except for any tool you want to be asked about.
          </li>
        </ol>
        <p style={{ ...BODY, color: "var(--text-3)" }}>
          Custom connectors need a Claude Pro, Max, Team or Enterprise plan.
        </p>
      </Collapsible>

      <Collapsible
        id="codex"
        title="Codex"
        subtitle="Add it with the CLI"
        icon={<CodexIcon width={16} height={16} />}
        narrow={narrow}
      >
        <p style={BODY}>Run this in your terminal:</p>
        <CodeBlock
          code={`codex mcp add upgradeseo --url ${mcpUrl}`}
          narrow={narrow}
          onCopy={() =>
            captureClientEvent("mcp:setup_command_copy", {
              agent: "codex",
            })
          }
        />
        <p style={BODY}>Approve the login when it prompts you.</p>
      </Collapsible>

      <Collapsible
        id="codex-desktop"
        title="Codex Desktop"
        subtitle="Settings, then Integrations & MCP"
        icon={<CodexIcon width={16} height={16} />}
        narrow={narrow}
      >
        <ol style={STEPS}>
          <li>Open Settings, then Integrations & MCP.</li>
          <li>Choose Add your own.</li>
          <li>Paste the MCP URL above.</li>
          <li>Approve the UpgradeSEO login when it prompts you.</li>
        </ol>
      </Collapsible>

      {/* Foundery is the only agent here that runs in someone else's
                  cloud rather than on the reader's machine, so it is the only
                  one whose steps can succeed against a URL and still fail
                  against a laptop. The caveat sits with the steps, not in a
                  footnote, because a localhost URL is the default state of
                  this screen during development. */}
      <Collapsible
        id="foundery"
        title="Foundery"
        subtitle="Azure AI Foundry, as an agent tool"
        icon={<Icon name="i-sparkle" size={16} />}
        narrow={narrow}
        last
      >
        <ol style={STEPS}>
          <li>Open your project in Azure AI Foundry.</li>
          <li>
            Go to Agents and select the agent you want to give SEO data to.
          </li>
          <li>Under its tools, add a Model Context Protocol tool.</li>
          <li>
            Paste the MCP URL above as the server URL, and name the server{" "}
            <code>upgradeseo</code>.
          </li>
          <li>Approve the UpgradeSEO login when it prompts you.</li>
        </ol>
        <p style={{ ...BODY, color: "var(--text-3)" }}>
          Foundery calls the server from Azure, not from your machine, so the
          URL has to be reachable from the internet. A localhost address works
          for Claude Code and Codex but not for this one.
        </p>
      </Collapsible>
    </Card>
  );
}

/** The skills installers and the tool list, below the setup guides. */
function SkillsAndTools({ narrow }: { narrow: boolean }) {
  return (
    <>
      <section>
        <SectionHeader title="UpgradeSEO skills" />
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 12.5,
            color: "var(--text-2)",
          }}
        >
          Skills give Codex and Claude Code reusable SEO workflows that call the
          MCP tools below when they need live SERP, keyword, backlink or domain
          data.
        </p>
        <Card>
          <Collapsible
            id="skills-add"
            title="Install with skills add"
            subtitle="The cross-agent installer, and the one to start with"
            narrow={narrow}
          >
            <CodeBlock code={SKILLS_INSTALL} narrow={narrow} />
            <p style={BODY}>Or accept every UpgradeSEO skill at once:</p>
            <CodeBlock code={ALL_SKILLS_INSTALL} narrow={narrow} />
            <p style={{ ...BODY, color: "var(--text-3)" }}>
              Replace YOUR_GITHUB_ORG with the GitHub org holding your
              UpgradeSEO repository.
            </p>
          </Collapsible>
          <Collapsible
            id="claude-code-skills"
            title="Install for Claude Code"
            subtitle="Claude Code only"
            icon={<ClaudeIcon width={16} height={16} />}
            narrow={narrow}
          >
            <CodeBlock code={CLAUDE_CODE_SKILLS_INSTALL} narrow={narrow} />
          </Collapsible>
          <Collapsible
            id="codex-skills"
            title="Install for Codex"
            subtitle="Codex only"
            icon={<CodexIcon width={16} height={16} />}
            narrow={narrow}
          >
            <CodeBlock code={CODEX_SKILLS_INSTALL} narrow={narrow} />
          </Collapsible>
          <Collapsible
            id="manual-skills"
            title="Copy the files yourself"
            subtitle="Clone the repository and copy the skills across"
            narrow={narrow}
            last
          >
            <CodeBlock code={SKILLS_MANUAL_INSTALL} narrow={narrow} />
          </Collapsible>
        </Card>
        <InfoNote>
          Start with seo-project-setup. It asks about your project and sets the
          workspace up around the answers.
        </InfoNote>
        <h3
          style={{
            margin: "14px 0 7px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Skills in this repository
        </h3>
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
            gap: "4px 16px",
            listStyle: "none",
            margin: 0,
            padding: 0,
            fontSize: 12.5,
            color: "var(--text-2)",
          }}
        >
          {SKILL_NAMES.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeader title="Available tools" />
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12.5,
            color: "var(--text-2)",
          }}
        >
          Everything this server exposes, named as an agent calls it.
        </p>
        <AvailableTools />
      </section>

      <section
        style={{ paddingTop: 16, borderTop: "1px solid var(--border-muted)" }}
      >
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
          Something missing or broken here? Tell us on{" "}
          <a href={DISCORD_URL} target="_blank" rel="noreferrer noopener">
            Discord
          </a>
          , or through <Link to="/support">Help & Community</Link>.
        </p>
      </section>
    </>
  );
}

const BODY = {
  margin: 0,
  fontSize: 12.5,
  color: "var(--text-2)",
} as const;

const STEPS = {
  margin: 0,
  paddingLeft: 18,
  display: "grid",
  gap: 4,
  fontSize: 12.5,
  color: "var(--text-2)",
  lineHeight: 1.5,
} as const;
