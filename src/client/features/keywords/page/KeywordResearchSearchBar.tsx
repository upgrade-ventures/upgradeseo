import { useState } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import { getFieldError } from "@/client/lib/forms";
import {
  isResultLimit,
  normalizeKeywordMode,
} from "@/client/features/keywords/keywordSearchParams";
import {
  MAX_KEYWORDS_PER_SUBMIT,
  RESULT_LIMITS,
} from "@/client/features/keywords/keywordResearchTypes";
import { LocationSelect } from "@/client/components/LocationSelect";
import { ProminenceSelect } from "./prominenceControls";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
};

function getTextareaRows(value: string): number {
  const newlines = (value.match(/\n/g) ?? []).length;
  const lines = newlines + 1;
  return Math.min(MAX_KEYWORDS_PER_SUBMIT, Math.max(1, lines));
}

/** Ties the keyword error message to the field it belongs to. */
const KEYWORD_ERROR_ID = "keyword-research-keyword-error";

export function KeywordResearchSearchBar({ controller }: Props) {
  const { controlsForm, handleSearchSubmit, isLoading } = controller;

  return (
    <form onSubmit={handleSearchSubmit}>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 14,
          paddingBottom: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <controlsForm.Field name="keyword">
          {(field) => (
            <KeywordField
              value={field.state.value}
              invalid={getFieldError(field.state.meta.errors) !== undefined}
              onChange={(value) => field.handleChange(value)}
              onSubmit={() => void controlsForm.handleSubmit()}
            />
          )}
        </controlsForm.Field>

        <controlsForm.Field name="locationCode">
          {(field) => (
            <LocationSelect
              value={field.state.value}
              onChange={(code) => field.handleChange(code)}
              className="w-44 shrink-0"
            />
          )}
        </controlsForm.Field>

        <controlsForm.Field name="resultLimit">
          {(field) => (
            <ProminenceSelect
              aria-label="Number of results"
              value={field.state.value}
              onChange={(event) => {
                const next = Number(event.target.value);
                field.handleChange(isResultLimit(next) ? next : 150);
              }}
            >
              {RESULT_LIMITS.map((limit) => (
                <option key={limit} value={limit}>
                  {limit} results
                </option>
              ))}
            </ProminenceSelect>
          )}
        </controlsForm.Field>

        <controlsForm.Field name="mode">
          {(field) => (
            <ProminenceSelect
              aria-label="Keyword match mode"
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(normalizeKeywordMode(event.target.value))
              }
            >
              <option value="auto">Auto</option>
              <option value="related">Related keywords</option>
              <option value="suggestions">Suggestions</option>
              <option value="ideas">Ideas</option>
            </ProminenceSelect>
          )}
        </controlsForm.Field>

        <SearchButton running={isLoading} />
      </div>

      <controlsForm.Field name="keyword">
        {(field) => {
          const keywordError = getFieldError(field.state.meta.errors);
          return keywordError ? (
            <p
              id={KEYWORD_ERROR_ID}
              role="alert"
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                color: "var(--danger)",
              }}
            >
              {keywordError}
            </p>
          ) : null;
        }}
      </controlsForm.Field>
    </form>
  );
}

function KeywordField({
  value,
  invalid,
  onChange,
  onSubmit,
}: {
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  // The design's `style-focus` sits on the wrapping label while focus actually
  // lands on the textarea, so the border colour is tracked here.
  const [focused, setFocused] = useState(false);
  const borderColor = invalid
    ? "var(--danger)"
    : focused
      ? "var(--accent)"
      : "var(--line)";

  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        flex: 1,
        minWidth: 260,
        maxWidth: 420,
        minHeight: 30,
        padding: "5px 10px",
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        background: "var(--surface)",
        // The ring goes on the wrapper because focus lands on the textarea,
        // whose own outline the design suppresses.
        ...(focused ? { boxShadow: "var(--focus)" } : null),
      }}
    >
      <Icon
        name="i-search"
        size={14}
        style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 3 }}
      />
      <textarea
        rows={getTextareaRows(value)}
        aria-label="Keyword to research"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? KEYWORD_ERROR_ID : undefined}
        placeholder="Enter a keyword. Shift + Enter for a second line."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          // Enter searches. Shift+Enter inserts a newline, so researching
          // several keywords at once means one keyword per line.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          resize: "none",
          background: "transparent",
          color: "var(--text)",
          fontFamily: "inherit",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      />
    </label>
  );
}

function SearchButton({ running }: { running: boolean }) {
  return (
    // The accent fill, its label colour, the hover and the focus ring all come
    // from the shared primary class, so no colour is written down twice or
    // hard-coded here. Only the design's own search-bar geometry is local.
    <button
      type="submit"
      className="prominence-button-primary"
      disabled={running}
      aria-busy={running || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        minHeight: "max(30px, var(--tap, 0px))",
        padding: "5px 14px",
        ...(running ? { cursor: "progress", opacity: 0.9 } : null),
      }}
    >
      {running ? (
        <>
          <span
            aria-hidden
            style={{
              width: 11,
              height: 11,
              borderRadius: 999,
              // Inherits the button's own label colour rather than naming one.
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              animation: "spin 1s linear infinite",
            }}
          />
          Searching…
        </>
      ) : (
        "Search"
      )}
    </button>
  );
}
