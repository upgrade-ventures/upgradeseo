import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { usePreferredKeywordLocation } from "@/client/features/keywords/hooks/usePreferredKeywordLocation";
import { useProjectMarket } from "@/client/features/projects/useProjectMarket";
import { saveKeywords } from "@/serverFunctions/keywords";
import type { SaveKeywordsInput } from "@/types/schemas/keywords";
import type { KeywordResearchRow } from "@/types/keywords";

export function useResolvedKeywordLocation(input: {
  projectId: string;
  locationCode?: number;
}) {
  const projectMarket = useProjectMarket(input.projectId);
  const {
    preferredLocationCode,
    selectedLocationCode,
    setPreferredLocationCode,
  } = usePreferredKeywordLocation(input.projectId, projectMarket?.locationCode);
  const locationCode = input.locationCode ?? selectedLocationCode;
  const displayedLocationCode = input.locationCode ?? preferredLocationCode;

  return { locationCode, displayedLocationCode, setPreferredLocationCode };
}

export function useKeywordUiState(initialShowFilters: boolean) {
  const [showFilters, setShowFilters] = useState(initialShowFilters);
  const [selectedKeyword, setSelectedKeyword] =
    useState<KeywordResearchRow | null>(null);
  // Named "confirm", not "dialog": saving is confirmed inline, above the table.
  // The design contains no modal anywhere, and this state must not grow one.
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  return {
    selectedKeyword,
    setSelectedKeyword,
    setShowFilters,
    setSaveConfirmOpen,
    showFilters,
    saveConfirmOpen,
  };
}

export function useKeywordSearchParams() {
  const navigate = useNavigate({ from: "/p/$projectId/keywords" });

  return useCallback(
    (updates: Record<string, string | number | boolean | undefined>) => {
      void navigate({
        search: (prev) => ({ ...prev, ...updates }),
        replace: true,
      });
    },
    [navigate],
  );
}

export function useKeywordSaveMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SaveKeywordsInput) => saveKeywords({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["savedKeywords", projectId],
      });
    },
  });
}
