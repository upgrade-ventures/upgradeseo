import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { SiteManagerCard } from "@/client/features/settings/SiteManagerCard";
import {
  formatDay,
  LIST_BOX,
  monogram,
  QuietNote,
  ROW_LINE,
  SECTION_LEDE,
  SECTION_TITLE,
  SkeletonBar,
  useFocusRing,
} from "@/client/features/settings/settingsParts";
import type { ProjectSummary } from "@/client/features/projects/types";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { createProject, getProjects } from "@/serverFunctions/projects";

const MANAGER_ID = "site-manager";

/**
 * The multi-site list.
 *
 * A "site" here is a project: the app's own unit of separation for keywords,
 * crawls and connections. The design's row meta ("128 keywords · Search Console
 * needs reconnecting") would need a per-site keyword count and connection
 * summary that the project list does not carry, and fetching either would mean
 * one extra round trip per row on a settings page. The row states what the
 * list actually knows; connection health is measured inside the manager card,
 * where it is for one site at a time.
 */
export function SitesSection({
  onOpenProviderKey,
}: {
  onOpenProviderKey: (provider: string) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const { focusRing, focusProps } = useFocusRing();

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });
  const projects = projectsQuery.data ?? [];
  const selected =
    projects.find((project) => project.id === selectedId) ?? null;

  const createMutation = useMutation({
    mutationFn: (value: string) =>
      createProject({ data: { name: value, domain: value } }),
    onSuccess: async (project) => {
      setDomain("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`${project.name} added`);
    },
    onError: (error) => setAddError(getStandardErrorMessage(error)),
  });

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const value = domain
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    if (!value) {
      setAddError("Enter a domain, for example newsite.com.");
      return;
    }
    setAddError(null);
    createMutation.mutate(value);
  };

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={SECTION_TITLE}>Sites</h2>
          <p style={SECTION_LEDE}>
            Add as many sites as you like. Each keeps its own keywords, crawls
            and connections, and nothing is shared between them.
          </p>
        </div>
        <form
          onSubmit={handleAdd}
          style={{ display: "flex", gap: 6, alignItems: "center" }}
        >
          <input
            type="text"
            value={domain}
            placeholder="newsite.com"
            aria-label="New site domain"
            aria-invalid={addError ? true : undefined}
            aria-describedby={addError ? "add-site-error" : undefined}
            onChange={(event) => {
              setDomain(event.target.value);
              if (addError) setAddError(null);
            }}
            {...focusProps}
            style={{
              minHeight: 28,
              padding: "4px 9px",
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "var(--surface)",
              color: "var(--text)",
              fontFamily: "inherit",
              fontSize: 12.5,
              width: 150,
              outline: "none",
              boxShadow: focusRing,
            }}
          />
          <PrimaryButton
            type="submit"
            icon="i-plus"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Adding…" : "Add site"}
          </PrimaryButton>
        </form>
      </div>

      {addError ? (
        <QuietNote tone="danger" style={{ margin: "8px 0 0" }}>
          <span id="add-site-error">{addError}</span>
        </QuietNote>
      ) : null}

      <div style={{ ...LIST_BOX, marginTop: 10 }}>
        {projectsQuery.isPending ? (
          <SiteRowSkeletons />
        ) : projectsQuery.isError ? (
          <div style={{ padding: "11px 12px" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
              {getStandardErrorMessage(
                projectsQuery.error,
                "We could not load your sites.",
              )}
            </p>
            <div style={{ marginTop: 9 }}>
              <SecondaryButton onClick={() => void projectsQuery.refetch()}>
                Try again
              </SecondaryButton>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "11px 12px",
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            No sites yet. Add one above to start tracking keywords and crawls.
          </p>
        ) : (
          projects.map((project, index) => (
            <SiteRow
              key={project.id}
              project={project}
              last={index === projects.length - 1}
              expanded={project.id === selectedId}
              onManage={() =>
                setSelectedId((current) =>
                  current === project.id ? null : project.id,
                )
              }
            />
          ))
        )}
      </div>

      {selected ? (
        <SiteManagerCard
          key={selected.id}
          id={MANAGER_ID}
          site={selected}
          canRemove={projects.length > 1}
          onClose={() => setSelectedId(null)}
          onOpenProviderKey={onOpenProviderKey}
        />
      ) : (
        <QuietNote>
          Choose Manage on a site to edit its name, market and connections.
        </QuietNote>
      )}
    </section>
  );
}

function SiteRow({
  project,
  last,
  expanded,
  onManage,
}: {
  project: ProjectSummary;
  last: boolean;
  expanded: boolean;
  onManage: () => void;
}) {
  const added = formatDay(project.createdAt);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderBottom: last ? undefined : ROW_LINE,
        // The design marks the open row only with aria-expanded. A keyboard or
        // screen-reader user gets that; a sighted user gets this tint, so the
        // card below is visibly tied to a row.
        background: expanded ? "var(--subtle)" : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          background: "var(--inset)",
          border: "1px solid var(--line)",
          color: "var(--text-2)",
          fontSize: 10,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {monogram(project.domain ?? project.name)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{project.name}</div>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>
          {project.domain ?? "No domain set"}
          {added ? ` · added ${added}` : ""}
        </div>
      </div>
      <SecondaryButton
        onClick={onManage}
        aria-expanded={expanded}
        aria-controls={expanded ? MANAGER_ID : undefined}
        style={{ minHeight: 24, padding: "2px 9px", fontSize: 12 }}
      >
        Manage
      </SecondaryButton>
    </div>
  );
}

function SiteRowSkeletons() {
  return (
    <div aria-hidden>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderBottom: row === 2 ? undefined : ROW_LINE,
          }}
        >
          <SkeletonBar width={20} height={20} />
          <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 5 }}>
            <SkeletonBar width={140} height={11} />
            <SkeletonBar width={200} height={9} />
          </div>
          <SkeletonBar width={62} height={22} />
        </div>
      ))}
    </div>
  );
}
