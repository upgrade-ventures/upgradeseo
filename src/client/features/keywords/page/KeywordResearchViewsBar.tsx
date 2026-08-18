import { Chip, Skeleton } from "./prominenceControls";
import {
  DIFFICULTY_CHIP_MAX,
  VOLUME_CHIP_MIN,
  activeKeywordView,
  isDifficultyChipOn,
  isVolumeChipOn,
  keywordViewPatch,
  type KeywordViewId,
} from "./keywordViews";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
  /** True while a keyword lookup is in flight, so counts read as pending. */
  loading: boolean;
};

const NO_DIFFICULTY_REASON =
  "Keyword difficulty is not available from the data sources connected to this project.";
const NO_INTENT_REASON =
  "Search intent is not available from the data sources connected to this project.";

export function KeywordResearchViewsBar({ controller, loading }: Props) {
  const {
    activeFilterCount,
    filteredRows,
    filterValues,
    filtersForm,
    rows,
    showFilters,
  } = controller;

  const hasDifficulty = rows.some((row) => row.keywordDifficulty !== null);
  const hasIntent = rows.some((row) => row.intent !== "unknown");
  const view = activeKeywordView(filterValues);

  const applyView = (id: KeywordViewId) => {
    const patch = keywordViewPatch(id, view === id);
    filtersForm.setFieldValue("minVol", patch.minVol);
    filtersForm.setFieldValue("maxKd", patch.maxKd);
    filtersForm.setFieldValue("intents", patch.intents);
  };

  return (
    <div
      role="group"
      aria-label="Saved views and quick filters"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px var(--pad, 24px)",
        borderBottom: "1px solid var(--line)",
        background: "var(--subtle)",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{ fontSize: 12, color: "var(--text-3)", marginRight: 2 }}
        id="keyword-views-label"
      >
        Views
      </span>

      <Chip
        shape="pill"
        active={view === "quick"}
        aria-pressed={view === "quick"}
        disabled={!hasDifficulty}
        title={hasDifficulty ? undefined : NO_DIFFICULTY_REASON}
        onClick={() => applyView("quick")}
      >
        Quick wins
      </Chip>
      <Chip
        shape="pill"
        active={view === "info"}
        aria-pressed={view === "info"}
        disabled={!hasIntent}
        title={hasIntent ? undefined : NO_INTENT_REASON}
        onClick={() => applyView("info")}
      >
        Informational
      </Chip>
      <Chip
        shape="pill"
        active={view === "volume"}
        aria-pressed={view === "volume"}
        onClick={() => applyView("volume")}
      >
        High volume
      </Chip>

      <span
        aria-hidden
        style={{
          width: 1,
          height: 16,
          background: "var(--line)",
          margin: "0 4px",
        }}
      />

      <Chip
        shape="chip"
        active={isVolumeChipOn(filterValues)}
        aria-pressed={isVolumeChipOn(filterValues)}
        onClick={() =>
          filtersForm.setFieldValue(
            "minVol",
            isVolumeChipOn(filterValues) ? "" : VOLUME_CHIP_MIN,
          )
        }
      >
        Volume ≥ {VOLUME_CHIP_MIN}
      </Chip>
      <Chip
        shape="chip"
        active={isDifficultyChipOn(filterValues)}
        aria-pressed={isDifficultyChipOn(filterValues)}
        disabled={!hasDifficulty}
        title={hasDifficulty ? undefined : NO_DIFFICULTY_REASON}
        onClick={() =>
          filtersForm.setFieldValue(
            "maxKd",
            isDifficultyChipOn(filterValues) ? "" : DIFFICULTY_CHIP_MAX,
          )
        }
      >
        KD ≤ {DIFFICULTY_CHIP_MAX}
      </Chip>
      {/* The design's "+ Filter" only fires a toast listing what could be
          filtered. The screen already has that filter panel, so it opens it. */}
      <Chip
        shape="chip"
        dashed
        aria-expanded={showFilters}
        aria-controls="keyword-filter-panel"
        onClick={() => controller.setShowFilters((current) => !current)}
      >
        + Filter
      </Chip>

      <span
        style={{
          marginLeft: "auto",
          fontSize: 12,
          color: "var(--text-2)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {loading ? (
          <Skeleton width={150} height={12} />
        ) : (
          <>
            <strong
              style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
            >
              {filteredRows.length}
            </strong>
            {` of ${rows.length} keywords · ${
              activeFilterCount === 1
                ? "1 filter on"
                : `${activeFilterCount} filters on`
            }`}
          </>
        )}
      </span>
    </div>
  );
}
