import {
  JobStatusPill,
  runJobState,
} from "@/client/components/prominence/JobStatus";

export function extractPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * A crawl timestamp as a Date.
 *
 * `audits.started_at` defaults to the database's `current_timestamp`, which
 * SQLite writes as "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker — JS would
 * otherwise read that as local time and shift every crawl by the viewer's
 * offset. Postgres and our own writes are already ISO and parse unchanged.
 */
function parseTimestamp(value: string): Date {
  const bareUtc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value);
  return new Date(bareUtc ? `${value.replace(" ", "T")}Z` : value);
}

export function formatStartedAt(dateStr: string): string {
  return parseTimestamp(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.345],
  ["month", 12],
];

export function formatRelativeTime(dateStr: string): string {
  let delta = (parseTimestamp(dateStr).getTime() - Date.now()) / 1000;
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(delta) < size) return RELATIVE.format(Math.round(delta), unit);
    delta /= size;
  }
  return RELATIVE.format(Math.round(delta), "year");
}

/** Wall-clock length of a finished crawl, e.g. "6m 21s". */
export function formatDuration(
  startedAt: string,
  completedAt: string | null,
): string | null {
  if (!completedAt) return null;
  const ms =
    parseTimestamp(completedAt).getTime() - parseTimestamp(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Short reference for a crawl.
 *
 * The design labels crawls "AUD-2411"; nothing in this product mints such a
 * number, so the run's own id is shortened rather than a sequence invented for
 * it. Callers pair this with a title carrying the full id.
 */
export function formatAuditRef(auditId: string): string {
  return `#${auditId.slice(0, 8)}`;
}

/**
 * A crawl's state, in the product's one status vocabulary.
 *
 * Crawls are stored as running / completed / failed; there is no queued row,
 * because a crawl is inserted at the moment the workflow starts. `needsAttention`
 * is passed by callers that know the crawl completed while leaving something to
 * decide, such as a crawl that only ever reached its start URL.
 */
export function CrawlStatusPill({
  status,
  needsAttention,
}: {
  status: string;
  needsAttention?: boolean;
}) {
  return <JobStatusPill state={runJobState(status, { needsAttention })} />;
}

/** HTTP status, coloured by class. */
export function HttpStatusBadge({ code }: { code: number | null }) {
  if (!code) {
    return <span style={{ color: "var(--text-3)" }}>&mdash;</span>;
  }
  const color =
    code < 300
      ? "var(--success)"
      : code < 400
        ? "var(--warning)"
        : "var(--danger)";
  return (
    <span
      style={{
        color,
        fontVariantNumeric: "tabular-nums",
        fontWeight: 600,
      }}
    >
      {code}
    </span>
  );
}
