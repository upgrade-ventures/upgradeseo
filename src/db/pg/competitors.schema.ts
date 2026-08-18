import { sql } from "drizzle-orm";
import { boolean, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./app.schema";

// See src/db/pg/app.schema.ts for why timestamps are ISO-8601 UTC text.
const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const timestampColumn = (name: string) => text(name);

// Competitor targeting footprints harvested from Common Crawl. Stored rather
// than fetched on demand: a CDX query takes 8-20s and 504s roughly half the
// time, so a page load can never wait on it. `harvestedAt` drives the
// refresh, and `unavailable` records a failed harvest so the UI can say "we
// could not reach Common Crawl" instead of "this competitor has no pages".
export const competitorProfiles = pgTable(
  "competitor_profiles",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    crawlId: text("crawl_id"),
    harvestedAt: timestampColumn("harvested_at"),
    // Common Crawl returned exactly the row limit, so the inventory is a
    // lower bound and its absent markets prove nothing.
    truncated: boolean("truncated").notNull().default(false),
    unavailable: boolean("unavailable").notNull().default(false),
    // location codes inferred from distinctive-language pages.
    targetsMarkets: text("targets_markets").notNull().default("[]"),
    createdAt: timestampColumn("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("competitor_profiles_project_domain_uidx").on(
      table.projectId,
      table.domain,
    ),
  ],
);

// One row per page the competitor publishes. `title`/`h1` are null when only
// the URL inventory was harvested and page content was not fetched.
export const competitorPages = pgTable(
  "competitor_pages",
  {
    id: text("id").primaryKey(),
    competitorId: text("competitor_id")
      .notNull()
      .references(() => competitorProfiles.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    languages: text("languages"),
    slug: text("slug"),
    title: text("title"),
    h1: text("h1"),
  },
  (table) => [
    uniqueIndex("competitor_pages_competitor_url_uidx").on(
      table.competitorId,
      table.url,
    ),
  ],
);
