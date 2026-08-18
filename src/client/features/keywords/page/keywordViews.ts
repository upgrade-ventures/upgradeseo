import {
  parseIntentFilter,
  type KeywordFilterValues,
} from "@/client/features/keywords/keywordResearchTypes";

/**
 * The saved views and quick-filter chips in the design's Views bar, expressed
 * as the local table filters the app already applies.
 *
 * Nothing new is stored: a chip is on when the filter it writes holds the
 * threshold printed on its label, and a view is active when the filters add up
 * to it. Deriving state this way is what makes a pill deselect itself once the
 * user edits one of its filters by hand, which the design leaves undefined.
 */

export const VOLUME_CHIP_MIN = "500";
export const DIFFICULTY_CHIP_MAX = "40";

export type KeywordViewId = "quick" | "info" | "volume";

/** The filter keys the pills and chips own. Everything else is left alone. */
type ViewPatch = Pick<KeywordFilterValues, "minVol" | "maxKd" | "intents">;

const VIEW_PATCHES: Record<KeywordViewId, ViewPatch> = {
  quick: { minVol: VOLUME_CHIP_MIN, maxKd: DIFFICULTY_CHIP_MAX, intents: "" },
  volume: { minVol: VOLUME_CHIP_MIN, maxKd: "", intents: "" },
  info: { minVol: "", maxKd: "", intents: "informational" },
};

const CLEARED: ViewPatch = { minVol: "", maxKd: "", intents: "" };

export function isVolumeChipOn(values: KeywordFilterValues): boolean {
  return values.minVol === VOLUME_CHIP_MIN;
}

export function isDifficultyChipOn(values: KeywordFilterValues): boolean {
  return values.maxKd === DIFFICULTY_CHIP_MAX;
}

function isInformationalOnly(values: KeywordFilterValues): boolean {
  const intents = parseIntentFilter(values.intents);
  return intents.length === 1 && intents[0] === "informational";
}

export function activeKeywordView(
  values: KeywordFilterValues,
): KeywordViewId | null {
  if (isInformationalOnly(values)) return "info";
  if (!isVolumeChipOn(values)) return null;
  return isDifficultyChipOn(values) ? "quick" : "volume";
}

/** Filters to write when a view pill is clicked. Clicking the active one clears. */
export function keywordViewPatch(
  view: KeywordViewId,
  currentlyActive: boolean,
): ViewPatch {
  return currentlyActive ? CLEARED : VIEW_PATCHES[view];
}
