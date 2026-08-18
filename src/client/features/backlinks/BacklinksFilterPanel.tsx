import { DomainFilterPanel } from "@/client/features/domain/components/DomainFilterPanel";
import { focusRing } from "@/client/features/domain/components/domainTableStyles";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import type { BacklinksTab } from "@/types/schemas/backlinks";
import {
  BACKLINKS_FILTER_FIELDS,
  REFERRING_DOMAINS_FILTER_FIELDS,
  TOP_PAGES_FILTER_FIELDS,
  countFilterConditions,
  type BacklinksTabFilterValues,
} from "./backlinksFilterTypes";
import type { BacklinksFiltersState } from "./useBacklinksFilters";

/**
 * Filters are applied explicitly (not per keystroke) because every change
 * triggers a fresh provider request. Each include/exclude term and each
 * set field costs one filter condition, capped per request —
 * DomainFilterPanel surfaces the count and gates Apply.
 */
export function BacklinksFilterPanel({
  activeTab,
  filters,
  onApplied,
}: {
  activeTab: BacklinksTab;
  filters: BacklinksFiltersState;
  onApplied: () => void;
}) {
  if (activeTab === "backlinks") {
    const state = filters.backlinks;
    return (
      <DomainFilterPanel
        key="backlinks"
        debugName="BacklinksFilterPanel"
        appliedFilters={state.values}
        fields={BACKLINKS_FILTER_FIELDS}
        activeFilterCount={state.activeFilterCount}
        countConditions={countFilterConditions}
        textFields={[
          {
            key: "include",
            label: "Source URL Contains",
            placeholder: "example.com, blog",
          },
          {
            key: "exclude",
            label: "Source URL Excludes",
            placeholder: "spam, forum",
          },
        ]}
        rangeFields={[
          {
            title: "Domain Authority",
            minKey: "minDomainRank",
            maxKey: "maxDomainRank",
          },
          {
            title: "Link Authority",
            minKey: "minLinkAuthority",
            maxKey: "maxLinkAuthority",
          },
          {
            title: "Spam Score",
            minKey: "minSpamScore",
            maxKey: "maxSpamScore",
            step: "0.1",
          },
        ]}
        onApply={(values) => {
          state.apply(values);
          onApplied();
        }}
        onClear={() => {
          state.reset();
          onApplied();
        }}
        renderExtra={(draft, setValue) => (
          <BacklinksToggleControls draft={draft} setValue={setValue} />
        )}
      />
    );
  }

  if (activeTab === "domains") {
    const state = filters.domains;
    return (
      <DomainFilterPanel
        key="domains"
        debugName="ReferringDomainsFilterPanel"
        appliedFilters={state.values}
        fields={REFERRING_DOMAINS_FILTER_FIELDS}
        activeFilterCount={state.activeFilterCount}
        countConditions={countFilterConditions}
        textFields={[
          {
            key: "include",
            label: "Domain Contains",
            placeholder: "example.com, blog",
          },
          {
            key: "exclude",
            label: "Domain Excludes",
            placeholder: "spam, forum",
          },
        ]}
        rangeFields={[
          {
            title: "Backlinks",
            minKey: "minBacklinks",
            maxKey: "maxBacklinks",
          },
          { title: "Rank", minKey: "minRank", maxKey: "maxRank" },
          {
            title: "Spam Score",
            minKey: "minSpamScore",
            maxKey: "maxSpamScore",
            step: "0.1",
          },
        ]}
        onApply={(values) => {
          state.apply(values);
          onApplied();
        }}
        onClear={() => {
          state.reset();
          onApplied();
        }}
      />
    );
  }

  const state = filters.pages;
  return (
    <DomainFilterPanel
      key="pages"
      debugName="TopPagesFilterPanel"
      appliedFilters={state.values}
      fields={TOP_PAGES_FILTER_FIELDS}
      activeFilterCount={state.activeFilterCount}
      countConditions={countFilterConditions}
      textFields={[
        {
          key: "include",
          label: "Page URL Contains",
          placeholder: "/blog, /products",
        },
        {
          key: "exclude",
          label: "Page URL Excludes",
          placeholder: "/tag, /author",
        },
      ]}
      rangeFields={[
        { title: "Backlinks", minKey: "minBacklinks", maxKey: "maxBacklinks" },
        {
          title: "Referring Domains",
          minKey: "minReferringDomains",
          maxKey: "maxReferringDomains",
        },
        { title: "Rank", minKey: "minRank", maxKey: "maxRank" },
      ]}
      onApply={(values) => {
        state.apply(values);
        onApplied();
      }}
      onClear={() => {
        state.reset();
        onApplied();
      }}
    />
  );
}

const GROUP_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  marginBottom: 6,
};

const CHECKBOX_ROW: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12.5,
  cursor: "pointer",
};

/** The design's segmented choice: selected carries the accent tint, and the
 * pressed state is exposed rather than left to colour alone. */
function LinkTypeButton({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <SecondaryButton
      aria-pressed={selected}
      onClick={onSelect}
      style={
        selected
          ? {
              background: "var(--accent-soft)",
              borderColor: "var(--accent-border)",
              color: "var(--accent)",
              fontWeight: 600,
            }
          : undefined
      }
    >
      {label}
    </SecondaryButton>
  );
}

const LINK_TYPES = [
  { value: "", label: "All" },
  { value: "dofollow", label: "Dofollow" },
  { value: "nofollow", label: "Nofollow" },
] as const;

function BacklinksToggleControls({
  draft,
  setValue,
}: {
  draft: BacklinksTabFilterValues;
  setValue: (key: keyof BacklinksTabFilterValues, value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
      <div>
        <span id="backlinks-link-type-label" style={GROUP_LABEL}>
          Link type
        </span>
        <div
          role="group"
          aria-labelledby="backlinks-link-type-label"
          style={{ display: "flex", gap: 4 }}
        >
          {LINK_TYPES.map((option) => (
            <LinkTypeButton
              key={option.value || "all"}
              selected={draft.linkType === option.value}
              label={option.label}
              onSelect={() => setValue("linkType", option.value)}
            />
          ))}
        </div>
      </div>

      <div>
        <span id="backlinks-visibility-label" style={GROUP_LABEL}>
          Visibility
        </span>
        <div
          role="group"
          aria-labelledby="backlinks-visibility-label"
          style={{ display: "flex", alignItems: "center", gap: 14 }}
        >
          <label style={CHECKBOX_ROW}>
            <input
              type="checkbox"
              style={CHECKBOX}
              checked={draft.hideLost === "true"}
              onChange={(event) =>
                setValue("hideLost", event.target.checked ? "true" : "")
              }
              {...focusRing<HTMLInputElement>()}
            />
            Hide lost
          </label>
          <label style={CHECKBOX_ROW}>
            <input
              type="checkbox"
              style={CHECKBOX}
              checked={draft.hideBroken === "true"}
              onChange={(event) =>
                setValue("hideBroken", event.target.checked ? "true" : "")
              }
              {...focusRing<HTMLInputElement>()}
            />
            Hide broken
          </label>
        </div>
      </div>
    </div>
  );
}

const CHECKBOX: React.CSSProperties = {
  width: 13,
  height: 13,
  margin: 0,
  accentColor: "var(--accent)",
  outline: "none",
  borderRadius: 3,
  cursor: "pointer",
};
