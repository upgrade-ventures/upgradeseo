import { KeywordDetailPanel } from "./KeywordDetailPanel";
import { KeywordResearchTable } from "./KeywordResearchTable";
import {
  KeywordResearchPagination,
  useKeywordResearchPagination,
} from "./KeywordResearchPagination";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
  projectId: string;
  /** Below the design's 1140px breakpoint the panel stacks under the table. */
  stacked: boolean;
};

export function KeywordResearchResults({
  controller,
  projectId,
  stacked,
}: Props) {
  const { page, pageSize, pageRows, setPage, setPageSize } =
    useKeywordResearchPagination(controller.filteredRows);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: stacked
          ? "minmax(0, 1fr)"
          : "minmax(360px, 1fr) minmax(240px, 320px)",
        alignItems: "start",
      }}
    >
      <div>
        <KeywordResearchTable controller={controller} pageRows={pageRows} />
        {controller.filteredRows.length > 0 ? (
          <KeywordResearchPagination
            page={page}
            pageSize={pageSize}
            totalCount={controller.filteredRows.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </div>
      <KeywordDetailPanel
        controller={controller}
        projectId={projectId}
        stacked={stacked}
      />
    </div>
  );
}
