/**
 * Keyword difficulty PROXY.
 *
 * A paid keyword_difficulty is a proprietary 0-100 score and nothing free
 * reproduces it. Rather than leave the field null (which reads as "easy" in
 * most UIs) or invent a number, we compute an explainable proxy from data we
 * genuinely have: the domain authority of the sites currently ranking for the
 * term, via OpenPageRank.
 *
 * The rule is deliberately simple and stated in the output, so nobody mistakes
 * it for a vendor score: if the top results are strong domains, the term is
 * hard; if they are weak or absent, it is not. Every value produced here is
 * tagged `method: "authority-proxy"` and carries the sample size it was
 * computed from.
 */

import type { DomainAuthority } from "@/server/lib/free-seo/openpagerank";

interface DifficultyEstimate {
  /** 0-100, comparable only against other values from this same method. */
  score: number;
  method: "authority-proxy";
  /** How many ranking domains the score was computed from. */
  sampleSize: number;
  /** Plain-language basis, surfaced to the user rather than hidden. */
  basis: string;
}

/**
 * OpenPageRank is 0-10 and roughly logarithmic; the top of the web sits at
 * 8-10 and a typical small business at 2-4. We map the MEAN authority of the
 * ranking set onto 0-100 linearly, which keeps the ordering honest without
 * implying more precision than the input has.
 */
export function estimateDifficulty(
  authorities: DomainAuthority[],
): DifficultyEstimate | null {
  const known = authorities
    .map((a) => a.pageRank)
    .filter((v): v is number => typeof v === "number" && v > 0);

  if (known.length === 0) {
    // No authority data at all is NOT "difficulty zero" — it is unknown, and
    // returning null keeps that distinction visible to the caller.
    return null;
  }

  const mean = known.reduce((sum, v) => sum + v, 0) / known.length;
  const score = Math.max(0, Math.min(100, Math.round(mean * 10)));

  return {
    score,
    method: "authority-proxy",
    sampleSize: known.length,
    basis:
      `Mean OpenPageRank authority ${mean.toFixed(2)}/10 across ${known.length} ` +
      `ranking domain${known.length === 1 ? "" : "s"}. This is an authority ` +
      `proxy, not a vendor difficulty score.`,
  };
}
