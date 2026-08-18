import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, FolderCog, Search } from "lucide-react";
import { createProject, getProjects } from "@/serverFunctions/projects";
import { setLastProjectId } from "@/client/lib/active-project";
import { toast } from "sonner";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  DEFAULT_LOCATION_CODE,
  getLanguageCode,
} from "@/shared/keyword-locations";
import type { ProjectSummary } from "./types";

// Below this many projects the plain list is faster to scan than a search box.
const SEARCH_THRESHOLD = 8;

export function ProjectSwitcher({
  activeProjectId,
  onCloseDrawer,
}: {
  activeProjectId: string | null;
  // Mobile sidebar passes this so switching / navigating away also closes the
  // drawer overlay.
  onCloseDrawer?: () => void;
}) {
  const navigate = useNavigate();
  // Controlled open state rather than daisyUI's CSS focus-within dropdown:
  // focus-within can't guarantee the search input ends up focused on open
  // (Safari never focuses buttons on click, and moving focus into the panel
  // is exactly what a combobox needs).
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });
  const projects = projectsQuery.data ?? [];
  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? null;

  const showSearch = projects.length >= SEARCH_THRESHOLD;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = normalizedQuery
    ? projects.filter(
        (project) =>
          project.name.toLowerCase().includes(normalizedQuery) ||
          project.domain?.toLowerCase().includes(normalizedQuery),
      )
    : projects;

  const openPanel = () => {
    setQuery("");
    setHighlightIndex(0);
    setOpen(true);
  };

  const closePanel = () => {
    setOpen(false);
    setQuery("");
  };

  // Opening the panel puts the caret straight in the search box, so
  // click → type → Enter selects a project with no extra step. Touch devices
  // are skipped: autofocus would pop the keyboard over the list.
  React.useEffect(() => {
    if (!open || !showSearch) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    searchInputRef.current?.focus();
  }, [open, showSearch]);

  const handleSelect = (project: ProjectSummary) => {
    closePanel();
    onCloseDrawer?.();
    if (project.id === activeProjectId) return;
    setLastProjectId(project.id);
    void navigate({
      to: "/p/$projectId",
      params: { projectId: project.id },
    });
  };

  const moveHighlight = (delta: number) => {
    setHighlightIndex((index) => {
      const next = index + delta;
      if (next < 0) return 0;
      if (next > filteredProjects.length - 1)
        return filteredProjects.length - 1;
      return next;
    });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const project = filteredProjects[highlightIndex] ?? filteredProjects[0];
      if (project) handleSelect(project);
    }
    // Escape is handled once at the root so it also works from the project
    // list and footer buttons.
  };

  // Type-ahead fallback on the trigger: if the user types while focus is
  // still on the trigger (touch skips autofocus; focus can also stay here
  // between open and the focus effect), open the panel and route the
  // keystroke into the search box instead of dropping it. Deliberately not
  // on the wrapper — that would also swallow keystrokes bubbling from the
  // menu items and the create-project modal rendered inside it.
  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (!showSearch) return;
    const isCharacter =
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey;
    if (isCharacter || event.key === "Backspace") {
      event.preventDefault();
      if (!open) setOpen(true);
      setQuery((current) =>
        isCharacter ? current + event.key : current.slice(0, -1),
      );
      setHighlightIndex(0);
      searchInputRef.current?.focus();
    } else if (!open && event.key === "ArrowDown") {
      event.preventDefault();
      openPanel();
    } else if (open && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      handleSearchKeyDown(event);
    }
  };

  // Escape closes the panel from anywhere inside the switcher — trigger,
  // search box, project list, or footer. When the create-project modal is up
  // the panel is already closed, so this never swallows the modal's own
  // Escape handling.
  const handleRootKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    closePanel();
    triggerRef.current?.focus();
  };

  // Close on clicks outside the switcher. Focus loss alone isn't used for
  // this (clicking a non-focusable spot inside the panel blurs to <body>),
  // so pointerdown containment is the single source of truth for "outside".
  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) {
        closePanel();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Also close when keyboard focus tabs out of the switcher entirely.
  const handleRootBlur = (event: React.FocusEvent) => {
    if (!open) return;
    const next = event.relatedTarget;
    if (next instanceof Node && !rootRef.current?.contains(next)) closePanel();
  };

  // Keep the keyboard highlight visible while arrowing through a scrolled
  // list.
  React.useEffect(() => {
    const highlighted = listRef.current?.querySelector(
      '[data-highlighted="true"]',
    );
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  return (
    <div
      ref={rootRef}
      onBlur={handleRootBlur}
      onKeyDown={handleRootKeyDown}
      // Hand-rolled positioning instead of daisyUI's .dropdown: its CSS also
      // shows the panel on :focus-within, which fights the controlled `open`
      // state (e.g. the panel would stay visible after closing while the
      // trigger still has focus).
      className="relative w-full"
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Switch project"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={handleTriggerKeyDown}
        className="prominence-switcher-trigger"
      >
        {/* Initials badge. The design shows the site's own mark here; two
            letters derived from the name is the closest honest stand-in. */}
        <span className="prominence-switcher-badge" aria-hidden="true">
          {initialsFor(activeProject?.name ?? activeProject?.domain ?? "?")}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">
          <span
            style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}
          >
            {activeProject?.domain ?? activeProject?.name ?? "Select project"}
          </span>
        </span>
        <ChevronsUpDown
          className="size-3.5 shrink-0"
          style={{ color: "var(--text-3)" }}
        />
      </button>

      {open ? (
        // z-index 40: the design's ladder puts the switcher below the palette
        // (50), the scrim (55) and the drawer (60).
        <div
          className="absolute left-0 right-0 top-full mt-1 overflow-hidden"
          style={{
            zIndex: 40,
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "var(--overlay)",
            boxShadow: "var(--shadow)",
          }}
        >
          {showSearch ? (
            <div className="border-b border-base-300 p-2">
              <label className="input input-sm w-full">
                <Search className="size-3.5 shrink-0 text-base-content/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  placeholder="Find project…"
                  aria-label="Filter projects"
                  aria-controls="project-switcher-listbox"
                  aria-activedescendant={
                    filteredProjects[highlightIndex]
                      ? `project-option-${filteredProjects[highlightIndex].id}`
                      : undefined
                  }
                  className="grow"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlightIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                />
              </label>
            </div>
          ) : null}

          {projects.length > 0 ? (
            // Long project lists scroll inside the dropdown; without the cap the
            // menu grows past the viewport and the footer becomes unreachable.
            // flex-nowrap because daisyUI menus wrap into columns by default.
            <ul
              ref={listRef}
              id="project-switcher-listbox"
              role="listbox"
              aria-label="Projects"
              className="menu max-h-[min(60vh,21rem)] w-full flex-nowrap overflow-y-auto p-2"
            >
              {filteredProjects.map((project, index) => {
                const isActive = project.id === activeProjectId;
                const isHighlighted = showSearch && index === highlightIndex;
                return (
                  <li key={project.id} role="presentation">
                    <button
                      type="button"
                      id={`project-option-${project.id}`}
                      role="option"
                      aria-selected={isActive}
                      data-highlighted={isHighlighted || undefined}
                      onClick={() => handleSelect(project)}
                      onMouseEnter={
                        showSearch ? () => setHighlightIndex(index) : undefined
                      }
                      className={
                        isActive ? "active" : isHighlighted ? "bg-base-200" : ""
                      }
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{project.name}</span>
                        {project.domain ? (
                          <span className="truncate text-xs text-base-content/60">
                            {project.domain}
                          </span>
                        ) : null}
                      </span>
                      {isActive ? (
                        <Check className="size-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {filteredProjects.length === 0 ? (
                <li className="menu-disabled">
                  <span className="text-base-content/60">
                    No projects match “{query.trim()}”
                  </span>
                </li>
              ) : null}
            </ul>
          ) : null}

          <ul
            className={`menu w-full shrink-0 p-2 ${
              projects.length > 0 ? "border-t border-base-300" : ""
            }`}
          >
            <li>
              <Link
                to="/projects"
                onClick={() => {
                  closePanel();
                  onCloseDrawer?.();
                }}
              >
                <FolderCog className="size-4" />
                Manage projects
              </Link>
            </li>
          </ul>
          <AddSiteField
            onCreated={() => {
              closePanel();
              onCloseDrawer?.();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The design's inline add-site field, in the switcher footer.
 *
 * Creating a site is a one-field action, so it happens in place rather than in
 * a dialog. The site is created with the domain as its name and the workspace
 * default market; everything else is edited afterwards in project settings.
 */
function AddSiteField({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [domain, setDomain] = React.useState("");

  const createMutation = useMutation({
    mutationFn: (value: string) =>
      createProject({
        data: {
          name: value,
          domain: value,
          locationCode: DEFAULT_LOCATION_CODE,
          languageCode: getLanguageCode(DEFAULT_LOCATION_CODE),
        },
      }),
    onSuccess: async (created) => {
      setLastProjectId(created.id);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDomain("");
      onCreated();
      toast.success(`${created.name} added`);
      // Land on the new site's settings so the next step (connecting Search
      // Console) is in front of them.
      void navigate({
        to: "/p/$projectId/settings",
        params: { projectId: created.id },
      });
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "Could not add the site")),
  });

  // Users paste full URLs; store the bare host.
  const normalized = domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");

  const submit = () => {
    if (!normalized || createMutation.isPending) return;
    createMutation.mutate(normalized);
  };

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-muted)",
        padding: "7px 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="text"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Add another site…"
          aria-label="Add another site"
          disabled={createMutation.isPending}
          className="prominence-add-site-input"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!normalized || createMutation.isPending}
          className="prominence-add-site-button"
        >
          {createMutation.isPending ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}

/**
 * Two-letter mark for the switcher badge.
 *
 * Prefers the initials of the first two words ("Acme Labs" -> "AL"); falls back
 * to the first two characters for a single word or a bare domain.
 */
function initialsFor(label: string): string {
  const words = label
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[\s.-]+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0] ?? label).slice(0, 2).toUpperCase();
}
