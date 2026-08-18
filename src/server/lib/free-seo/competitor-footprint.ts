/**
 * A competitor's targeting footprint: every page they publish, what each page
 * claims to be about, and which of our markets it is aimed at.
 *
 * This is the honest free answer to "what does this competitor go after". It
 * is NOT a ranked-keyword list and nothing here may be rendered in a column
 * called "position". The distinction the whole free stack rests on:
 *
 *   what they TARGET  → this file, free, near-complete for any site with a
 *                       sitemap or a Common Crawl presence
 *   what they RANK for → no free licensed source exists; only a human running
 *                        a search can put that number in the database
 *
 * Content comes from Common Crawl, so building a footprint sends ZERO requests
 * to the competitor's server.
 */

import {
  createCommonCrawlClient,
  DEFAULT_CDX_LIMIT,
  type CdxRecord,
  type CommonCrawlClient,
} from "@/server/lib/free-seo/commoncrawl";
import {
  extractPageTerms,
  slugPhrase,
  type PageTerms,
} from "@/server/lib/free-seo/page-terms";
import { MARKETS, pageTargetsMarket } from "@/server/lib/free-seo/markets";

interface CompetitorPage {
  url: string;
  /** Common Crawl's ISO 639-3 language(s), e.g. "eng" or "ara,eng". */
  languages: string | null;
  /** The URL slug as a phrase. Present even when content was not fetched. */
  slug: string | null;
  terms: PageTerms | null;
  source: "commoncrawl";
}

export interface CompetitorFootprint {
  domain: string;
  crawlId: string;
  pages: CompetitorPage[];
  /**
   * location codes this competitor publishes content for, inferred
   * from page language. Evidence of intent, not of ranking.
   */
  targetsMarkets: number[];
  /**
   * True when Common Crawl failed rather than returned nothing. Callers must
   * surface this instead of reporting "no pages found", which would read as
   * the competitor having no web presence.
   */
  unavailable: boolean;
  /**
   * True when the index returned exactly as many rows as we asked for, so
   * there are almost certainly more. Because truncation follows sorted URL
   * order rather than being random, `targetsMarkets` is then a LOWER BOUND
   * and its absences prove nothing. Must be surfaced anywhere markets are
   * shown.
   */
  truncated: boolean;
}

interface FootprintOptions {
  client?: CommonCrawlClient;
  /** How many CDX rows to request. */
  limit?: number;
  /** How many pages to fetch full content for. Content is the slow part. */
  contentLimit?: number;
}

export async function buildCompetitorFootprint(
  domain: string,
  options: FootprintOptions = {},
): Promise<CompetitorFootprint> {
  const client = options.client ?? createCommonCrawlClient();
  const contentLimit = options.contentLimit ?? 40;

  const limit = options.limit ?? DEFAULT_CDX_LIMIT;

  const crawlId = await client.latestCrawlId();
  if (!crawlId) return unavailableFootprint(domain, "");

  const records = await client.domainUrls({
    domain,
    crawlId,
    limit,
    withContentPointers: true,
  });
  if (records === null) return unavailableFootprint(domain, crawlId);

  const usable = dedupeByUrl(
    records.filter((r) => r.status === "200" && isContentUrl(r.url)),
  );

  const pages: CompetitorPage[] = usable.map((record) => ({
    url: record.url,
    languages: record.languages,
    slug: slugPhrase(record.url),
    terms: null,
    source: "commoncrawl" as const,
  }));

  // Content is fetched for a bounded prefix only. Sequential on purpose:
  // Common Crawl is donation-funded and already flaky under load, and this is
  // a monthly batch job where politeness costs us nothing.
  for (let i = 0; i < Math.min(contentLimit, usable.length); i++) {
    const html = await client.fetchWarcRecord(usable[i]);
    if (html) pages[i].terms = extractPageTerms(html);
  }

  return {
    domain,
    crawlId,
    pages,
    targetsMarkets: inferTargetMarkets(pages),
    unavailable: false,
    // A full-to-the-limit result means the tail was cut, and the tail is
    // where the non-English pages live.
    truncated: records.length >= limit,
  };
}

function unavailableFootprint(
  domain: string,
  crawlId: string,
): CompetitorFootprint {
  return {
    domain,
    crawlId,
    pages: [],
    targetsMarkets: [],
    unavailable: true,
    truncated: false,
  };
}

/**
 * Which markets this page set is aimed at, by language. A competitor
 * publishing Arabic pages is contesting the Gulf whether or not they say so.
 */
export function inferTargetMarkets(pages: CompetitorPage[]): number[] {
  const hits = new Set<number>();
  for (const market of MARKETS) {
    for (const page of pages) {
      // Common Crawl's detected language first; the page's own <html lang>
      // is the fallback, since a page can declare a language it barely uses.
      const language = page.languages ?? page.terms?.lang ?? null;
      if (
        pageTargetsMarket(
          { language, hreflang: page.terms?.hreflang },
          market.locationCode,
        )
      ) {
        hits.add(market.locationCode);
        break;
      }
    }
  }
  return [...hits];
}

/**
 * How much of the content corpus a phrase must appear on before we call it
 * site furniture rather than a targeted term. "Menu", "About us" and "Contact
 * us" appear in the header of every page; a real target term does not.
 *
 * Threshold rather than a hand-written stopword list because a list is never
 * finished and is wrong in every language but the one it was written in.
 */
const BOILERPLATE_PAGE_SHARE = 0.4;
const MIN_PAGES_TO_JUDGE_BOILERPLATE = 5;

/**
 * The terms this competitor targets, most-repeated first. Built from titles,
 * H1s and slugs, the three fields a competitor controls deliberately.
 *
 * Navigation chrome is removed: any phrase appearing on more than
 * BOILERPLATE_PAGE_SHARE of the pages we read content for is treated as
 * furniture and dropped, including when it also happens to be a slug.
 */
export function footprintPhrases(footprint: CompetitorFootprint): Array<{
  phrase: string;
  count: number;
  evidenceUrl: string;
}> {
  const seen = new Map<
    string,
    { count: number; evidenceUrl: string; contentPages: Set<string> }
  >();

  const add = (
    raw: string | null | undefined,
    url: string,
    fromContent: boolean,
  ) => {
    if (!raw) return;
    const phrase = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (phrase.length < 4) return;
    let entry = seen.get(phrase);
    if (!entry) {
      entry = { count: 0, evidenceUrl: url, contentPages: new Set() };
      seen.set(phrase, entry);
    }
    entry.count += 1;
    // Only content-derived hits can indicate boilerplate. A slug repeats
    // across pages only when the URLs genuinely repeat it.
    if (fromContent) entry.contentPages.add(url);
  };

  const pagesWithContent = footprint.pages.filter((p) => p.terms).length;

  for (const page of footprint.pages) {
    add(page.slug, page.url, false);
    add(page.terms?.title, page.url, true);
    for (const h of page.terms?.h1 ?? []) add(h, page.url, true);
  }

  const canJudge = pagesWithContent >= MIN_PAGES_TO_JUDGE_BOILERPLATE;

  return [...seen.entries()]
    .filter(([, v]) => {
      if (!canJudge) return true;
      return v.contentPages.size / pagesWithContent <= BOILERPLATE_PAGE_SHARE;
    })
    .map(([phrase, v]) => ({
      phrase,
      count: v.count,
      evidenceUrl: v.evidenceUrl,
    }))
    .toSorted((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));
}

/**
 * Common Crawl indexes everything it fetched, including `robots.txt`, feeds
 * and assets. Those are not pages a competitor targets a keyword with, and
 * left in they dominate the phrase list: a live antler.co run put "robots.txt"
 * at the top with 9 hits.
 */
const NON_CONTENT =
  /\.(xml|txt|json|css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|pdf|zip|gz|mp4|webm|rss|atom)$/i;

export function isContentUrl(url: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  if (NON_CONTENT.test(pathname)) return false;
  // WordPress and framework internals are crawled but never targeted.
  return !/\/(wp-json|wp-admin|wp-includes|cdn-cgi|_next\/static)\//i.test(
    pathname,
  );
}

/** Same URL appears with and without www, and with tracking params. */
function dedupeByUrl(records: CdxRecord[]): CdxRecord[] {
  const seen = new Set<string>();
  const out: CdxRecord[] = [];
  for (const record of records) {
    let key: string;
    try {
      const parsed = new URL(record.url);
      key = `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
    } catch {
      key = record.url;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}
