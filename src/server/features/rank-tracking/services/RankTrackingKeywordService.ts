import { RankTrackingRepository } from "@/server/features/rank-tracking/repositories/RankTrackingRepository";
import { AppError } from "@/server/lib/errors";
import { MAX_KEYWORDS_PER_CONFIG } from "@/shared/rank-tracking";

async function addKeywords(
  configId: string,
  projectId: string,
  keywords: string[],
) {
  await getValidatedConfig(configId, projectId);
  const existing = await RankTrackingRepository.getKeywordsForConfig(configId);

  if (existing.length >= MAX_KEYWORDS_PER_CONFIG) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Maximum ${MAX_KEYWORDS_PER_CONFIG} keywords per domain. Currently tracking ${existing.length}.`,
    );
  }

  const existingKeywords = new Set(existing.map((kw) => kw.keyword));
  const available = MAX_KEYWORDS_PER_CONFIG - existing.length;
  const seen = new Set<string>();
  const rows: Array<{ id: string; configId: string; keyword: string }> = [];

  for (const raw of keywords) {
    if (rows.length >= available) break;
    const normalized = raw.trim().toLowerCase();
    if (
      normalized &&
      !seen.has(normalized) &&
      !existingKeywords.has(normalized)
    ) {
      seen.add(normalized);
      rows.push({ id: crypto.randomUUID(), configId, keyword: normalized });
    }
  }

  const addedIds =
    rows.length > 0
      ? await RankTrackingRepository.addKeywordsToConfig(rows)
      : [];

  return { added: addedIds.length, addedIds };
}

async function removeKeywords(
  configId: string,
  projectId: string,
  keywordIds: string[],
) {
  await getValidatedConfig(configId, projectId);
  const uniqueIds = [...new Set(keywordIds)];
  const removedIds = await RankTrackingRepository.removeKeywordsFromConfig(
    uniqueIds,
    configId,
  );
  return { removed: removedIds.length, removedIds };
}

async function getValidatedConfig(configId: string, projectId: string) {
  const config = await RankTrackingRepository.getConfigById({
    configId,
    projectId,
  });
  if (!config) {
    throw new AppError("NOT_FOUND", "Rank tracking config not found");
  }
  return config;
}

export const RankTrackingKeywordService = {
  addKeywords,
  removeKeywords,
};
