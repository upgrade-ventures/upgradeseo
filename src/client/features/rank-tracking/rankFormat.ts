/**
 * Timestamp and number formatting for the rank screen.
 *
 * The design writes dates as "14 Aug, 09:44" and timeline stamps as
 * "14 Aug · 11:42", both in the viewer's locale-independent short form so a
 * column of them stays the same width.
 */

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function parse(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "14 Aug" — history column heads and short references. */
export function formatDay(value: string): string {
  const date = parse(value);
  return date ? DAY_MONTH.format(date) : "—";
}

/** "14 Aug, 09:44" — the header's last-checked stamp. */
export function formatStamp(value: string): string {
  const date = parse(value);
  return date ? `${DAY_MONTH.format(date)}, ${TIME.format(date)}` : "—";
}

/** "14 Aug · 11:42" — the activity timeline. */
export function formatTimelineStamp(value: string): string {
  const date = parse(value);
  return date ? `${DAY_MONTH.format(date)} · ${TIME.format(date)}` : "—";
}

/** Thousands-separated, as the design writes volumes ("1,600"). */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
