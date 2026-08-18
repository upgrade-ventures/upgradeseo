/**
 * Pulls the keyword-bearing parts out of a page's HTML.
 *
 * These are the fields a competitor chose deliberately: the title and H1 are
 * their claim about what the page is for, and the URL slug is the same claim
 * written as a filename. Together they are the closest free reading of what a
 * page is TARGETING. Body text is deliberately not extracted; it is mostly
 * navigation and boilerplate at this level of parsing and it dilutes the
 * signal rather than adding to it.
 *
 * Regex, dependency-free, matching the style of `scrape.ts`. Pure function,
 * so it tests with no mocks and no network.
 */

export interface PageTerms {
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  /** hreflang targets declared by the page, lowercased ("ar-ae", "fr"). */
  hreflang: string[];
  /** The <html lang> attribute, if present. */
  lang: string | null;
}

const BLOCK_TAGS = /<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;

export function extractPageTerms(html: string): PageTerms {
  // Strip blocks first: a <script> containing markup would otherwise produce
  // phantom headings.
  const clean = html.replace(BLOCK_TAGS, " ").replace(COMMENTS, " ");

  return {
    title: firstText(clean, /<title[^>]*>([\s\S]*?)<\/title>/i),
    metaDescription: metaContent(clean, "description"),
    h1: allText(clean, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi),
    h2: allText(clean, /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi),
    hreflang: hreflangTargets(clean),
    lang: attributeValue(clean, /<html\b[^>]*\slang=["']([^"']+)["']/i),
  };
}

/**
 * Terms implied by a URL path. A competitor's slug set is their keyword
 * strategy in plain text, so this is high-signal and free.
 *
 * Returns the whole slug as a phrase ("build-for-equity-faq" becomes "build
 * for equity faq"), because the individual words are far less useful than the
 * phrase they form.
 */
export function slugPhrase(url: string): string | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const last = path.split("/").filter(Boolean).pop();
  if (!last) return null;
  const phrase = last
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  // Numeric-only segments are pagination or ids, not keywords.
  if (!phrase || /^\d+$/.test(phrase)) return null;
  return phrase;
}

function firstText(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  return match ? normalise(match[1]) : null;
}

function allText(html: string, pattern: RegExp): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  // Callers pass a fresh literal each time, so lastIndex starts at 0.
  while ((match = pattern.exec(html)) !== null) {
    const text = normalise(match[1]);
    if (text) out.push(text);
  }
  return out;
}

/** Handles both attribute orders: name-then-content and content-then-name. */
function metaContent(html: string, name: string): string | null {
  const forward = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const reverse = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`,
    "i",
  );
  return firstText(html, forward) ?? firstText(html, reverse);
}

function hreflangTargets(html: string): string[] {
  const out = new Set<string>();
  const pattern = /<link\b[^>]*\shreflang=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const value = match[1].trim().toLowerCase();
    // x-default declares a fallback, not a market.
    if (value && value !== "x-default") out.add(value);
  }
  return [...out];
}

function attributeValue(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  return match ? match[1].trim().toLowerCase() : null;
}

function normalise(value: string): string | null {
  const text = decodeEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
