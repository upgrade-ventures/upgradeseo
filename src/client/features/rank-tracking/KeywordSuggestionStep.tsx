import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { getDomainKeywordSuggestions } from "@/serverFunctions/domain";
import { addTrackingKeywords } from "@/serverFunctions/rank-tracking";
import { isLabsLocationCode } from "@/client/features/keywords/locations";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import {
  AppDataTable,
  makeSelectionColumn,
  useAppTable,
} from "@/client/components/table/AppDataTable";
import {
  applyShiftRangeSelection,
  type SelectionAnchor,
} from "@/client/components/table/tableSelection";
import { Dash, Skeleton, useInteractive } from "./RankScreenParts";

/** Sortable column head with an explaining tooltip, used only by this step. */
function SortableHeader({
  column,
  label,
  tooltip,
}: {
  column: {
    getIsSorted: () => false | "asc" | "desc";
    getToggleSortingHandler: () => ((event: unknown) => void) | undefined;
  };
  label: string;
  tooltip: string;
}) {
  const { focused, interactiveProps } = useInteractive();
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      // Inherits the header cell's own 11px uppercase type rather than
      // restating it, so sortable and plain columns read identically.
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 0,
        border: "none",
        background: "none",
        font: "inherit",
        color: "inherit",
        textTransform: "inherit",
        letterSpacing: "inherit",
        cursor: "pointer",
        outline: "none",
        boxShadow: focused ? "var(--focus)" : undefined,
      }}
      {...interactiveProps}
      onClick={column.getToggleSortingHandler()}
      title={tooltip}
      aria-label={`Sort by ${label}`}
      aria-pressed={!!sorted}
    >
      {label}
      <span aria-hidden style={{ opacity: sorted ? 1 : 0 }}>
        {sorted === "desc" ? "▾" : "▴"}
      </span>
    </button>
  );
}

type SuggestedKeyword = {
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  traffic: number | null;
};

const PRE_SELECT_COUNT = 20;

const baseColumns: ColumnDef<SuggestedKeyword>[] = [
  {
    id: "keyword",
    accessorKey: "keyword",
    header: ({ column }) => (
      <SortableHeader
        column={column}
        label="Keyword"
        tooltip="The search term this domain ranks for"
      />
    ),
    cell: ({ getValue }) => (
      <span style={{ fontWeight: 600 }}>{getValue<string>()}</span>
    ),
    sortingFn: "alphanumeric",
  },
  {
    id: "position",
    accessorKey: "position",
    header: ({ column }) => (
      <SortableHeader
        column={column}
        label="Position"
        tooltip="Current Google ranking position"
      />
    ),
    cell: ({ getValue }) => {
      const pos = getValue<number | null>();
      return pos != null ? pos : <Dash />;
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.position ?? 999;
      const b = rowB.original.position ?? 999;
      return a - b;
    },
    meta: { numeric: true },
  },
  {
    id: "searchVolume",
    accessorKey: "searchVolume",
    header: ({ column }) => (
      <SortableHeader
        column={column}
        label="Volume"
        tooltip="Monthly search volume"
      />
    ),
    cell: ({ getValue }) => {
      const vol = getValue<number | null>();
      return vol != null ? vol.toLocaleString() : <Dash />;
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.searchVolume ?? 0;
      const b = rowB.original.searchVolume ?? 0;
      return a - b;
    },
    meta: { numeric: true },
  },
  {
    id: "traffic",
    accessorKey: "traffic",
    header: ({ column }) => (
      <SortableHeader
        column={column}
        label="Traffic"
        tooltip="Estimated monthly organic traffic"
      />
    ),
    cell: ({ getValue }) => {
      const traffic = getValue<number | null>();
      return traffic != null ? Math.round(traffic).toLocaleString() : <Dash />;
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.traffic ?? 0;
      const b = rowB.original.traffic ?? 0;
      return a - b;
    },
    meta: { numeric: true },
  },
];

type Props = {
  configId: string;
  projectId: string;
  domain: string;
  locationCode: number;
  onDone: (configId: string) => void;
  onClose: () => void;
};

/** Message + actions block shared by the four non-table states. */
function StepMessage({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--subtle)",
        padding: "26px 16px",
        textAlign: "center",
        fontSize: 12.5,
        color: "var(--text-2)",
      }}
    >
      <div>{children}</div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {actions}
      </div>
    </div>
  );
}

export function KeywordSuggestionStep({
  configId,
  projectId,
  domain,
  locationCode,
  onDone,
  onClose,
}: Props) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [hasInitialized, setHasInitialized] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "traffic", desc: true },
  ]);
  const selectAnchorRef = useRef<SelectionAnchor | null>(null);

  const columns = useMemo<ColumnDef<SuggestedKeyword>[]>(
    () => [
      makeSelectionColumn<SuggestedKeyword>(selectAnchorRef, {
        itemNoun: "suggested keyword",
        describeRow: (row) => row.keyword,
      }),
      ...baseColumns,
    ],
    [],
  );

  // Ranked-keyword suggestions are Labs-backed; countries served from Google
  // Ads keyword data (e.g. Iceland) have no ranking data to suggest from.
  // The tracker's language is deliberately not sent — rank tracking can pair
  // any SERP language with any country, and the server resolves a Labs-served
  // language for this country (resolveLabsMarket in serverFunctions/domain.ts).
  const labsSupported = isLabsLocationCode(locationCode);
  const suggestionsQuery = useQuery({
    queryKey: ["domainKeywordSuggestions", projectId, domain, locationCode],
    queryFn: () =>
      getDomainKeywordSuggestions({
        data: { projectId, domain, locationCode },
      }),
    enabled: labsSupported,
  });

  const data = suggestionsQuery.data ?? [];

  // Pre-select top 20 by traffic once data loads.
  useEffect(() => {
    const items = suggestionsQuery.data;
    if (items && items.length > 0 && !hasInitialized) {
      const indexed = items.map((item, i) => ({
        index: i,
        traffic: item.traffic ?? 0,
      }));
      indexed.sort((a, b) => b.traffic - a.traffic);
      const initial: RowSelectionState = {};
      for (let i = 0; i < Math.min(PRE_SELECT_COUNT, indexed.length); i++) {
        initial[indexed[i].index] = true;
      }
      setRowSelection(initial);
      setHasInitialized(true);
    }
  }, [suggestionsQuery.data, hasInitialized]);

  const table = useAppTable({
    data,
    columns,
    state: { rowSelection, sorting },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    withSorting: true,
    enableRowSelection: true,
  });

  const selectedCount = Object.keys(rowSelection).filter(
    (k) => rowSelection[k],
  ).length;

  const addMutation = useMutation({
    mutationFn: (keywords: string[]) =>
      addTrackingKeywords({ data: { projectId, configId, keywords } }),
    onSuccess: (result) => {
      toast.success(
        `${result.added} keyword${result.added === 1 ? "" : "s"} added for tracking`,
      );
      onDone(configId);
    },
    onError: (error) => {
      toast.error(getStandardErrorMessage(error, "Failed to add keywords"));
    },
  });

  const handleAdd = () => {
    const selectedKeywords = table
      .getSelectedRowModel()
      .rows.map((row) => row.original.keyword);
    if (selectedKeywords.length > 0) {
      addMutation.mutate(selectedKeywords);
    }
  };

  if (!labsSupported) {
    return (
      <StepMessage
        actions={<PrimaryButton onClick={onClose}>Continue</PrimaryButton>}
      >
        Ranked-keyword suggestions are not available for this country. Continue
        and add the keywords you want to track by hand.
      </StepMessage>
    );
  }

  if (suggestionsQuery.isLoading) {
    // Skeleton rows rather than a spinner, so the panel keeps its height and
    // the buttons below it do not jump when the suggestions land.
    return (
      <div
        aria-busy
        aria-label={`Looking up the keywords ${domain} already ranks for`}
        style={{ display: "flex", flexDirection: "column", gap: 9 }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} width="100%" height={16} />
        ))}
      </div>
    );
  }

  if (suggestionsQuery.isError) {
    return (
      <StepMessage
        actions={
          <>
            <SecondaryButton onClick={() => void suggestionsQuery.refetch()}>
              Try again
            </SecondaryButton>
            <PrimaryButton onClick={onClose}>Skip</PrimaryButton>
          </>
        }
      >
        {getStandardErrorMessage(
          suggestionsQuery.error,
          "Could not fetch the keywords this domain ranks for.",
        )}{" "}
        You can skip this step and add keywords by hand later.
      </StepMessage>
    );
  }

  if (data.length === 0) {
    return (
      <StepMessage
        actions={<PrimaryButton onClick={onClose}>Skip</PrimaryButton>}
      >
        No keywords {domain} currently ranks for were found, so there is nothing
        to suggest. You can add keywords by hand.
      </StepMessage>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
        {data.length.toLocaleString()} keyword
        {data.length === 1 ? "" : "s"} {domain} ranks for. The top{" "}
        {Math.min(PRE_SELECT_COUNT, data.length)} by traffic are ticked already.
      </p>

      <AppDataTable
        table={table}
        wrapperStyle={{
          overflowY: "auto",
          overflowX: "auto",
          maxHeight: 400,
          border: "1px solid var(--line)",
          borderRadius: 8,
        }}
        stickyHeader
        getRowProps={(row) => ({
          className: "cursor-pointer",
          onClick: (event) => {
            if (applyShiftRangeSelection(event, row, table, selectAnchorRef)) {
              return;
            }

            row.toggleSelected();
          },
        })}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            color: "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {selectedCount.toLocaleString()} of {data.length.toLocaleString()}{" "}
          selected
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SecondaryButton onClick={onClose}>Skip</SecondaryButton>
          <PrimaryButton
            onClick={handleAdd}
            disabled={addMutation.isPending || selectedCount === 0}
            title={
              selectedCount === 0 ? "Tick at least one keyword" : undefined
            }
            style={addMutation.isPending ? { cursor: "progress" } : undefined}
          >
            {addMutation.isPending
              ? "Adding…"
              : `Track ${selectedCount} keyword${selectedCount === 1 ? "" : "s"}`}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
