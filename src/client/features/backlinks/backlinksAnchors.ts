import type { BacklinksRow } from "./backlinksPageTypes";

/**
 * How many individual links the anchors tab counts over.
 *
 * Anchor text is real (Bing Webmaster Tools reports it per link), but no free
 * source publishes a whole-profile anchor breakdown, so the tab counts the
 * links it actually holds and says so. The cap is the largest page size the
 * request schema accepts.
 */
export const ANCHOR_SAMPLE_SIZE = 200;

export type AnchorRow = {
  anchor: string;
  backlinks: number;
  /** Share of the counted links, 0-100. */
  share: number;
};

export type AnchorSummary = {
  rows: AnchorRow[];
  /** Links that carried anchor text; the denominator behind `share`. */
  counted: number;
  /** Links with no anchor text (image and bare-element links). */
  withoutAnchor: number;
};

/** Groups the links we hold by anchor text, most-used first. */
export function buildAnchorSummary(links: BacklinksRow[]): AnchorSummary {
  const counts = new Map<string, number>();
  let counted = 0;
  let withoutAnchor = 0;

  for (const link of links) {
    const anchor = link.anchor?.trim();
    if (!anchor) {
      withoutAnchor += 1;
      continue;
    }
    counted += 1;
    counts.set(anchor, (counts.get(anchor) ?? 0) + 1);
  }

  const rows = [...counts]
    .map(([anchor, backlinks]) => ({
      anchor,
      backlinks,
      share: (backlinks / counted) * 100,
    }))
    .toSorted(
      (a, b) => b.backlinks - a.backlinks || a.anchor.localeCompare(b.anchor),
    );

  return { rows, counted, withoutAnchor };
}
