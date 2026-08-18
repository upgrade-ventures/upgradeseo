import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import { normalizeBacklinksTarget } from "@/server/lib/backlinksTarget";
import {
  normalizeBacklinksSpamFilterOptions,
  type BacklinksLookupInput,
  type BacklinksSpamFilterOptions,
} from "@/types/schemas/backlinks";
import {
  profileBacklinksOverview,
  profileBacklinksRowsPage,
  profileReferringDomainsPage,
  profileTopPagesPage,
  type BacklinksCache,
  type BacklinksRowsPageServiceInput,
  type ReferringDomainsPageServiceInput,
  type TopPagesPageServiceInput,
} from "@/server/features/backlinks/services/backlinksServiceData";
import type { OrganizationContext } from "@/server/auth/organizationContext";

const defaultCache: BacklinksCache = {
  get: getCached,
  set: setCached,
};

type BacklinksPageCacheInput = {
  target: string;
  scope?: "domain" | "page";
  page: number;
  pageSize: number;
  sortField: string;
  sortOrder: string;
  filters: Record<string, unknown>;
  /** Backlinks rows only: `one_per_domain` or `as_is` result grouping. */
  mode?: string;
};

function createBacklinksService(cache: BacklinksCache = defaultCache) {
  return {
    async profileOverview(
      input: BacklinksLookupInput,
      billingCustomer: OrganizationContext,
      // (e.g. onboarding) keep compiling. The free sources behind this lookup
      // are unmetered, so there is nothing left to charge.
    ) {
      const cacheKey = await buildCacheKey("backlinks:overview", {
        ...buildTargetCacheInput(input, billingCustomer),
      });

      return profileBacklinksOverview(cache, cacheKey, input, billingCustomer);
    },
    async profileBacklinksPage(
      input: BacklinksRowsPageServiceInput,
      billingCustomer: OrganizationContext,
      options?: BacklinksSpamFilterOptions,
    ) {
      const cacheKey = await buildPageCacheKey(
        "backlinks:rows-page",
        input,
        billingCustomer,
        options,
      );

      return profileBacklinksRowsPage(cache, cacheKey, input, billingCustomer);
    },
    async profileReferringDomainsPage(
      input: ReferringDomainsPageServiceInput,
      billingCustomer: OrganizationContext,
      options?: BacklinksSpamFilterOptions,
    ) {
      const cacheKey = await buildPageCacheKey(
        "backlinks:referring-domains-page",
        input,
        billingCustomer,
        options,
      );

      return profileReferringDomainsPage(
        cache,
        cacheKey,
        input,
        billingCustomer,
      );
    },
    async profileTopPagesPage(
      input: TopPagesPageServiceInput,
      billingCustomer: OrganizationContext,
    ) {
      const cacheKey = await buildPageCacheKey(
        "backlinks:top-pages-page",
        input,
        billingCustomer,
      );

      return profileTopPagesPage(cache, cacheKey, input, billingCustomer);
    },
  } as const;
}

function buildTargetCacheInput(
  input: BacklinksLookupInput,
  billingCustomer: OrganizationContext,
) {
  const normalizedTarget = normalizeBacklinksTarget(input.target, {
    scope: input.scope,
  });

  return {
    organizationId: billingCustomer.organizationId,
    target: normalizedTarget.apiTarget,
    scope: normalizedTarget.scope,
  };
}

async function buildPageCacheKey(
  prefix: string,
  input: BacklinksPageCacheInput,
  billingCustomer: OrganizationContext,
  options?: BacklinksSpamFilterOptions,
): Promise<string> {
  // Kept in the key, not passed to the tabs: no free source publishes a spam
  // score, so the rows cannot be spam-filtered and every row's spamScore is
  // null. Keying on it still keeps a caller's entries separate from another's
  // for the day a spam source exists.
  const spamFilterOptions = normalizeBacklinksSpamFilterOptions(options);

  return buildCacheKey(prefix, {
    ...buildTargetCacheInput(input, billingCustomer),
    page: input.page,
    pageSize: input.pageSize,
    sortField: input.sortField,
    sortOrder: input.sortOrder,
    filters: input.filters,
    ...(input.mode ? { mode: input.mode } : {}),
    hideSpam: String(spamFilterOptions.hideSpam),
    ...(spamFilterOptions.hideSpam
      ? { spamThreshold: String(spamFilterOptions.spamThreshold) }
      : {}),
  });
}

export const BacklinksService = createBacklinksService();
