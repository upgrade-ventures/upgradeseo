/**
 * Competitor targeting footprints: harvest, store, read.
 *
 * WHAT THIS ANSWERS: which keywords a competitor is TARGETING, read from the
 * pages they publish. It does NOT answer where they rank — no free, licensed
 * source provides that, so nothing here may be rendered in a column called
 * "position". See docs 16-SEO-RESEARCH §3b.
 *
 * Harvesting is a stored operation, never a page-load fetch: a Common Crawl
 * CDX query measured 8-20s and 504'd on roughly half of attempts, so the UI
 * reads the last stored harvest and refreshes on an explicit action.
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { competitorPages, competitorProfiles } from "@/db/schema";
import {
  buildCompetitorFootprint,
  footprintPhrases,
  type CompetitorFootprint,
} from "@/server/lib/free-seo/competitor-footprint";
import { marketFor } from "@/server/lib/free-seo/markets";

interface CompetitorSummary {
  id: string;
  domain: string;
  crawlId: string | null;
  harvestedAt: string | null;
  truncated: boolean;
  unavailable: boolean;
  pageCount: number;
  /** Human-readable market labels inferred from distinctive-language pages. */
  markets: string[];
  /** Top targeted phrases, each with a page to go check. */
  phrases: Array<{ phrase: string; count: number; evidenceUrl: string }>;
}

/** Columns bound per competitor_pages row; keep in sync with the insert. */
const PAGE_COLUMN_COUNT = 7;
const D1_MAX_BOUND_PARAMS = 100;
const PAGE_INSERT_BATCH = Math.floor(D1_MAX_BOUND_PARAMS / PAGE_COLUMN_COUNT);

export const PAGE_INSERT_LIMITS = {
  columns: PAGE_COLUMN_COUNT,
  maxBoundParams: D1_MAX_BOUND_PARAMS,
  batch: PAGE_INSERT_BATCH,
} as const;

/** Strips scheme, path and www so "https://Antler.co/x" and "antler.co" match. */
export function normaliseCompetitorDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function addCompetitor(input: {
  projectId: string;
  domain: string;
}): Promise<string> {
  const domain = normaliseCompetitorDomain(input.domain);
  if (!domain) throw new Error("Enter a valid domain");

  const existing = await db
    .select({ id: competitorProfiles.id })
    .from(competitorProfiles)
    .where(
      and(
        eq(competitorProfiles.projectId, input.projectId),
        eq(competitorProfiles.domain, domain),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const id = crypto.randomUUID();
  await db.insert(competitorProfiles).values({
    id,
    projectId: input.projectId,
    domain,
  });
  return id;
}

export async function removeCompetitor(
  projectId: string,
  competitorId: string,
): Promise<void> {
  // Scoped by projectId as well as id so an id from another project cannot be
  // used to delete someone else's row.
  await db
    .delete(competitorProfiles)
    .where(
      and(
        eq(competitorProfiles.id, competitorId),
        eq(competitorProfiles.projectId, projectId),
      ),
    );
}

/**
 * Fetches the footprint from Common Crawl and replaces the stored pages.
 *
 * A failed harvest updates `unavailable` and leaves the previously stored
 * pages alone: stale data plus an honest "could not reach Common Crawl" beats
 * wiping a good inventory because a donation-funded service timed out.
 */
export async function harvestCompetitor(input: {
  projectId: string;
  competitorId: string;
  contentLimit?: number;
}): Promise<void> {
  const [profile] = await db
    .select()
    .from(competitorProfiles)
    .where(
      and(
        eq(competitorProfiles.id, input.competitorId),
        eq(competitorProfiles.projectId, input.projectId),
      ),
    )
    .limit(1);
  if (!profile) throw new Error("Competitor not found");

  const footprint = await buildCompetitorFootprint(profile.domain, {
    contentLimit: input.contentLimit ?? 25,
  });

  const now = new Date().toISOString();

  if (footprint.unavailable) {
    await db
      .update(competitorProfiles)
      .set({ unavailable: true, harvestedAt: now })
      .where(eq(competitorProfiles.id, profile.id));
    return;
  }

  await db
    .delete(competitorPages)
    .where(eq(competitorPages.competitorId, profile.id));

  const rows = footprint.pages.map((page) => ({
    id: crypto.randomUUID(),
    competitorId: profile.id,
    url: page.url,
    languages: page.languages,
    slug: page.slug,
    title: page.terms?.title ?? null,
    h1: page.terms?.h1[0] ?? null,
  }));

  // D1 caps BOUND PARAMETERS at 100 per statement, not rows. Each row binds
  // one value per column, so the batch size is that budget divided by the
  // column count — chunking by rows instead sent 700 variables and failed with
  // "D1_ERROR: too many SQL variables".
  for (let i = 0; i < rows.length; i += PAGE_INSERT_BATCH) {
    await db
      .insert(competitorPages)
      .values(rows.slice(i, i + PAGE_INSERT_BATCH));
  }

  await db
    .update(competitorProfiles)
    .set({
      crawlId: footprint.crawlId,
      harvestedAt: now,
      truncated: footprint.truncated,
      unavailable: false,
      targetsMarkets: JSON.stringify(footprint.targetsMarkets),
    })
    .where(eq(competitorProfiles.id, profile.id));
}

export async function listCompetitors(
  projectId: string,
): Promise<CompetitorSummary[]> {
  const profiles = await db
    .select()
    .from(competitorProfiles)
    .where(eq(competitorProfiles.projectId, projectId));

  const summaries: CompetitorSummary[] = [];
  for (const profile of profiles) {
    const pages = await db
      .select()
      .from(competitorPages)
      .where(eq(competitorPages.competitorId, profile.id));

    // Rebuild the shape footprintPhrases expects so phrase ranking and the
    // boilerplate filter stay in ONE place rather than being reimplemented.
    const footprint: CompetitorFootprint = {
      domain: profile.domain,
      crawlId: profile.crawlId ?? "",
      unavailable: profile.unavailable,
      truncated: profile.truncated,
      targetsMarkets: [],
      pages: pages.map((page) => ({
        url: page.url,
        languages: page.languages,
        slug: page.slug,
        source: "commoncrawl" as const,
        terms:
          page.title || page.h1
            ? {
                title: page.title,
                metaDescription: null,
                h1: page.h1 ? [page.h1] : [],
                h2: [],
                hreflang: [],
                lang: null,
              }
            : null,
      })),
    };

    summaries.push({
      id: profile.id,
      domain: profile.domain,
      crawlId: profile.crawlId,
      harvestedAt: profile.harvestedAt,
      truncated: profile.truncated,
      unavailable: profile.unavailable,
      pageCount: pages.length,
      markets: parseMarkets(profile.targetsMarkets),
      phrases: footprintPhrases(footprint).slice(0, 25),
    });
  }
  return summaries;
}

function parseMarkets(stored: string): string[] {
  try {
    const codes: unknown = JSON.parse(stored);
    if (!Array.isArray(codes)) return [];
    return codes
      .filter((code): code is number => typeof code === "number")
      .map((code) => marketFor(code).label);
  } catch {
    return [];
  }
}
