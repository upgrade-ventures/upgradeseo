import { useEffect, useMemo, useState } from "react";
import type { KeywordResearchRow } from "@/types/keywords";
import { PagerButton, ProminenceSelect } from "./prominenceControls";

const KEYWORD_RESEARCH_PAGE_SIZES = [50, 100, 300, 500] as const;
const DEFAULT_KEYWORD_RESEARCH_PAGE_SIZE = 50;
const KEYWORD_RESEARCH_PAGE_SIZE_STORAGE_KEY =
  "keyword-research-table-page-size";

type KeywordResearchPageSize = (typeof KEYWORD_RESEARCH_PAGE_SIZES)[number];

type Props = {
  page: number;
  pageSize: KeywordResearchPageSize;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: KeywordResearchPageSize) => void;
};

export function KeywordResearchPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalCount, page * pageSize);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px var(--pad, 24px)",
        borderTop: "1px solid var(--line)",
        color: "var(--text-2)",
        fontSize: 12,
      }}
    >
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {`Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${totalCount.toLocaleString()}`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginRight: 4,
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>Rows per page</span>
          <ProminenceSelect
            value={pageSize}
            onChange={(event) =>
              onPageSizeChange(parseKeywordResearchPageSize(event.target.value))
            }
            style={{
              minHeight: "max(26px, var(--tap, 0px))",
              padding: "3px 6px",
              fontSize: 12,
            }}
          >
            {KEYWORD_RESEARCH_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </ProminenceSelect>
        </label>
        <PagerButton
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          Previous
        </PagerButton>
        <PagerButton
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
        </PagerButton>
      </div>
    </div>
  );
}

function parseKeywordResearchPageSize(value: string): KeywordResearchPageSize {
  const parsed = Number(value);
  return (
    KEYWORD_RESEARCH_PAGE_SIZES.find((size) => size === parsed) ??
    DEFAULT_KEYWORD_RESEARCH_PAGE_SIZE
  );
}

export function useKeywordResearchPagination(rows: KeywordResearchRow[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<KeywordResearchPageSize>(() =>
    getStoredKeywordResearchPageSize(),
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [rows]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);

  return {
    page,
    pageSize,
    pageRows,
    setPage,
    setPageSize: (nextPageSize: KeywordResearchPageSize) => {
      setPageSize(nextPageSize);
      persistKeywordResearchPageSize(nextPageSize);
      setPage(1);
    },
    totalPages,
  };
}

function getStoredKeywordResearchPageSize(): KeywordResearchPageSize {
  if (typeof window === "undefined") return DEFAULT_KEYWORD_RESEARCH_PAGE_SIZE;
  try {
    const stored = window.localStorage.getItem(
      KEYWORD_RESEARCH_PAGE_SIZE_STORAGE_KEY,
    );
    return stored
      ? parseKeywordResearchPageSize(stored)
      : DEFAULT_KEYWORD_RESEARCH_PAGE_SIZE;
  } catch {
    return DEFAULT_KEYWORD_RESEARCH_PAGE_SIZE;
  }
}

function persistKeywordResearchPageSize(pageSize: KeywordResearchPageSize) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEYWORD_RESEARCH_PAGE_SIZE_STORAGE_KEY,
      String(pageSize),
    );
  } catch {
    // localStorage can be unavailable; keep the in-memory selection working.
  }
}
