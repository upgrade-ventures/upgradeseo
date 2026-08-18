import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Icon } from "@/client/components/icons/IconSprite";
import {
  connectNavGroup,
  getProjectNavGroups,
} from "@/client/navigation/items";

/**
 * The ⌘K command palette.
 *
 * The design gives this a query that filters two lists — ACTIONS (verbs, with a
 * shortcut letter) and JUMPS (destinations) — a centred overlay at 12vh, and an
 * `esc` hint. Its sample jumps are fixtures (crawl ids and the like); here they
 * are the real nav destinations, because a palette that lists rows you cannot
 * open is worse than one that lists fewer.
 *
 * Keyboard selection (arrows / enter / home / end) is NOT in the design, which
 * specifies only ⌘K to open and esc to close. A command palette you cannot
 * drive from the keyboard defeats the point of a keyboard shortcut, so it is
 * added here deliberately.
 */

type PaletteRow = {
  id: string;
  label: string;
  /** Shortcut letter, shown right-aligned. Actions have one; jumps do not. */
  hint?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  projectId,
  onClose,
}: {
  open: boolean;
  projectId: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const rows = usePaletteRows(projectId, navigate, onClose);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.label.toLowerCase().includes(q));
  }, [rows, query]);

  // A fresh query starts selection at the top; without this the cursor can sit
  // past the end of a newly-narrowed list and Enter does nothing.
  useEffect(() => setCursor(0), [query]);

  // Reset on open so the palette never reappears holding the last search.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view when arrowing past the visible window.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (filtered.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (c + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (c - 1 + filtered.length) % filtered.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setCursor(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setCursor(filtered.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      filtered[cursor]?.run();
    }
  };

  return (
    <div
      className="prominence-palette-overlay"
      // Only a click on the backdrop itself dismisses; a click that started
      // inside the dialog and drifted out must not.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="prominence-palette"
        onKeyDown={onKeyDown}
      >
        <div className="prominence-palette-input-row">
          <Icon name="i-search" size={15} style={{ color: "var(--text-3)" }} />
          <input
            ref={inputRef}
            type="text"
            aria-label="Search commands and objects"
            aria-controls="prominence-palette-list"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="prominence-palette-input"
          />
          <kbd className="prominence-palette-esc">esc</kbd>
        </div>

        <div
          id="prominence-palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Results"
          className="prominence-palette-list"
        >
          {filtered.length === 0 ? (
            <div className="prominence-palette-empty">
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Nothing matches “{query}”
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  marginTop: 3,
                }}
              >
                Try a keyword, a domain, or an action such as “audit”.
              </div>
            </div>
          ) : (
            filtered.map((row, index) => (
              <div
                key={row.id}
                role="option"
                aria-selected={index === cursor}
                data-selected={index === cursor}
                className="prominence-palette-row"
                onClick={row.run}
                onMouseEnter={() => setCursor(index)}
              >
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>▸</span>
                <span style={{ flex: 1, fontSize: 13 }}>{row.label}</span>
                {row.hint ? (
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {row.hint}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Actions first, then every nav destination as a jump. */
function usePaletteRows(
  projectId: string | null,
  navigate: ReturnType<typeof useNavigate>,
  onClose: () => void,
): PaletteRow[] {
  return useMemo(() => {
    // Every destination comes from the nav model, whose entries are already
    // `linkOptions` and therefore correctly typed for navigate(). Building a
    // generic (to, params) helper here would need a cast to satisfy the router's
    // route-literal types, and a cast is exactly how a palette ends up shipping
    // a row that navigates nowhere.
    const navItems = [
      ...(projectId
        ? getProjectNavGroups(projectId).flatMap((g) => g.items)
        : []),
      ...connectNavGroup.items,
    ];

    const jump = (item: (typeof navItems)[number]) => () => {
      onClose();
      void navigate(item);
    };

    const byPath = (path: string) => navItems.find((item) => item.to === path);

    // Verbs first, in the design's order. Each reuses its nav destination, so an
    // action can never point somewhere the sidebar does not.
    const actions: Array<{
      id: string;
      label: string;
      hint: string;
      path: string;
    }> = [
      {
        id: "action-keywords",
        label: "Research a keyword",
        hint: "K",
        path: "/p/$projectId/keywords",
      },
      {
        id: "action-audit",
        label: "Run a site audit",
        hint: "A",
        path: "/p/$projectId/audit",
      },
      {
        id: "action-rank",
        label: "Check ranks now",
        hint: "R",
        path: "/p/$projectId/rank-tracking",
      },
    ];

    const rows: PaletteRow[] = [];
    for (const action of actions) {
      const item = byPath(action.path);
      if (!item) continue;
      rows.push({
        id: action.id,
        label: action.label,
        hint: action.hint,
        run: jump(item),
      });
    }
    rows.push({
      id: "action-settings",
      label: "Open settings",
      hint: "S",
      run: () => {
        onClose();
        void navigate({ to: "/settings" });
      },
    });

    for (const item of navItems) {
      rows.push({
        id: `jump-${item.to}`,
        label: item.label,
        run: jump(item),
      });
    }

    return rows;
  }, [projectId, navigate, onClose]);
}
