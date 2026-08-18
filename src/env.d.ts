// Custom environment variable type definitions
// These extend the auto-generated Env interface from worker-configuration.d.ts

declare namespace Cloudflare {
  interface Env {
    R2: R2Bucket;
    OAUTH_KV: KVNamespace;

    // Durable Object backing the onboarding strategy chat (see wrangler.jsonc).

    // Durable Object holding per-audit crawl scratch state (frontier, link
    // edges, page mirror). Untyped here; getAuditScratchpad narrows the stub.
    AUDIT_SCRATCHPAD: DurableObjectNamespace;

    AUTH_MODE?: "cloudflare_access" | "local_noauth" | "hosted";
    BYPASS_EMAIL_VERIFICATION?: string;
    TEAM_DOMAIN?: string;
    POLICY_AUD?: string;
    POSTHOG_PUBLIC_KEY?: string;
    POSTHOG_HOST?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    DATABASE_PROVIDER?: "d1" | "postgres";
    HYPERDRIVE?: {
      connectionString: string;
    };
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    LOOPS_API_KEY?: string;
    LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID?: string;
    LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID?: string;
    // HMAC secret for the operator-only GDPR storage-erasure endpoint.
    GDPR_ERASURE_SECRET?: string;

    // Cloudflare Turnstile — signup captcha (hosted only). Secret verifies
    // tokens server-side; site key is public and inlined into the client build.
    TURNSTILE_SECRET_KEY?: string;
    TURNSTILE_SITE_KEY?: string;

    // THE PROVIDER STACK. Every source here is free.
    // Bing Webmaster Tools: free, no card, one key per user. Its keyword
    // methods take a bare query (no siteUrl), so they work for any term.
    BING_WEBMASTER_API_KEY?: string;

    // Google Ads: four secrets as one JSON blob + the manager customer id.
    GOOGLE_ADS_CREDENTIALS?: string;
    GOOGLE_ADS_CUSTOMER_ID?: string;

    // Azure AI Foundry, the sanctioned AI provider for the chat agents.
    FOUNDERY_API_KEY?: string;
    FOUNDERY_ENDPOINT?: string;

    // PageSpeed Insights (free key; keyless calls hit a shared 429 quota).
    PAGESPEED_API_KEY?: string;

    // Encrypts provider keys entered through Settings.
    SECRETS_ENCRYPTION_KEY?: string;
    // OpenPageRank: free 30k domains/month. Domain authority for ANY domain,
    // which powers the keyword-difficulty proxy.
    OPENPAGERANK_API_KEY?: string;

    // OpenRouter API key for the in-app onboarding chat agent.
    OPENROUTER_API_KEY?: string;
    // Optional OpenRouter model slug override (defaults in openrouter.ts).
    OPENROUTER_MODEL?: string;
  }
}

interface ImportMetaEnv {
  readonly AUTH_MODE?: "cloudflare_access" | "local_noauth" | "hosted";
  readonly DATABASE_PROVIDER?: "d1" | "postgres";
  readonly BYPASS_EMAIL_VERIFICATION?: string;
  readonly POSTHOG_PUBLIC_KEY?: string;
  readonly POSTHOG_HOST?: string;
  readonly TURNSTILE_SITE_KEY?: string;
  readonly VITE_E2E_DOMAIN_FIXTURES?: string;
  readonly VITE_E2E_KEYWORD_FIXTURES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
