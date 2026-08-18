import { useNavigate } from "@tanstack/react-router";
import {
  downloadKeywordResearchCsv,
  KEYWORD_RESEARCH_HEADERS,
  keywordResearchExportRow,
} from "@/client/features/keywords/state/keywordControllerActions";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import { captureClientEvent } from "@/client/lib/posthog";
import { BarButton, GhostButton } from "./prominenceControls";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
  projectId: string;
};

export function KeywordResearchSelectionBar({ controller, projectId }: Props) {
  const navigate = useNavigate();
  const { filteredRows, selectedRows } = controller;

  if (selectedRows.size === 0) return null;

  const exportRows = filteredRows
    .filter((row) => selectedRows.has(row.keyword))
    .map(keywordResearchExportRow);

  const exportCsv = () => {
    downloadKeywordResearchCsv(exportRows);
    captureClientEvent("data:export", {
      source_feature: "keyword_research",
      result_count: exportRows.length,
      scope: "selection",
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px var(--pad, 24px)",
        background: "var(--accent-soft)",
        borderBottom: "1px solid var(--accent-border)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600 }} role="status">
        {selectedRows.size} selected
      </span>
      <BarButton onClick={controller.handleSaveKeywords}>
        Save to a list
      </BarButton>
      {/* The design's Track opens the rank screen. There is no way to attach a
          keyword to a tracked domain from here, so this navigates and leaves
          the choice of domain to that screen. */}
      <BarButton
        onClick={() =>
          void navigate({
            to: "/p/$projectId/rank-tracking",
            params: { projectId },
          })
        }
      >
        Track
      </BarButton>
      <BarButton onClick={exportCsv}>Export CSV</BarButton>
      <BarButton
        onClick={() =>
          void exportTableToSheets({
            headers: KEYWORD_RESEARCH_HEADERS,
            rows: exportRows,
            feature: "keyword_research",
          })
        }
      >
        Export to Sheets
      </BarButton>
      <GhostButton
        style={{ marginLeft: "auto" }}
        onClick={() => controller.setSelectedRows(new Set())}
      >
        Clear selection
      </GhostButton>
    </div>
  );
}
