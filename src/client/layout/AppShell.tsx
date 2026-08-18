import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MobileSidebarDrawer,
  SeoApiStatusBanners,
} from "@/client/layout/AppShellParts";
import { Sidebar } from "@/client/components/Sidebar";
import { getSeoApiKeyStatus } from "@/serverFunctions/config";
import { getProjects } from "@/serverFunctions/projects";
import { getLastProjectId } from "@/client/lib/active-project";
import { CommandPalette } from "@/client/layout/CommandPalette";
import {
  ShellHeaderNarrow,
  ShellHeaderWide,
} from "@/client/layout/ShellHeader";
import { useBreadcrumb } from "@/client/layout/useBreadcrumb";
import { useSession } from "@/lib/auth-client";
import { useShellBreakpoint } from "@/client/layout/useShellBreakpoint";

export function AuthenticatedAppLayout({
  children,
  projectId,
  banner,
}: {
  children: React.ReactNode;
  projectId?: string;
  banner?: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const { narrow } = useShellBreakpoint(rootRef);
  // Drives the top-right account control. Undefined in self-hosted modes,
  // where there is no session to show and the menu renders its signed-out form.
  const { data: session } = useSession();
  // On non-project pages (e.g. /settings) there's no projectId in the URL, so
  // derive one for the nav/switcher: prefer the last-visited project, else the
  // most recent. The whole app tree is client-only (see root ClientOnly), so we
  // can read localStorage synchronously during the first render — this lets the
  // sidebar show the full project nav on the very first paint instead of briefly
  // flashing only the always-visible Connect group while projects load.
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
    enabled: !projectId,
  });
  const [rememberedProjectId] = React.useState<string | null>(() =>
    getLastProjectId(),
  );
  const fallbackProjects = projectsQuery.data ?? [];
  const fallbackProjectId =
    fallbackProjects.find((project) => project.id === rememberedProjectId)
      ?.id ??
    fallbackProjects[0]?.id ??
    null;
  // Once the projects list loads, fallbackProjectId is the validated choice
  // (remembered-if-valid, else most recent). Before it loads, fall back to the
  // remembered id so the project nav renders immediately; a stale id here only
  // builds links that self-correct via the route guard once data arrives.
  const sidebarProjectId =
    projectId ?? fallbackProjectId ?? rememberedProjectId;
  const crumb = useBreadcrumb(sidebarProjectId);
  // Breadcrumb root. The design shows the site's own domain; fall back to its
  // name, and render nothing rather than a placeholder when neither has loaded.
  const activeProject = fallbackProjects.find(
    (project) => project.id === sidebarProjectId,
  );
  // Prefer the domain; the project NAME is the fallback, and "Default" is what
  // an unnamed project is called, so it is suppressed rather than shown as if
  // it were a site.
  const siteLabel =
    activeProject?.domain ??
    (activeProject?.name && activeProject.name !== "Default"
      ? activeProject.name
      : null);
  const seoApiKeyStatusQuery = useQuery({
    queryKey: ["seoApiKeyStatus"],
    queryFn: () => getSeoApiKeyStatus(),
  });
  const isSeoApiKeyConfigured = seoApiKeyStatusQuery.data?.configured ?? null;
  const seoApiKeyStatusError = seoApiKeyStatusQuery.isError;

  const shouldShowSeoApiWarning =
    !seoApiKeyStatusError && isSeoApiKeyConfigured === false;

  // ⌘K / Ctrl+K opens the palette from anywhere. Registered in the capture
  // phase so it still fires while focus is inside an input, which is where a
  // user reaching for a command palette usually is.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "k" && event.key !== "K") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // Growing past the narrow breakpoint force-closes the drawer, so the overlay
  // never lingers once the sidebar is back in the layout.
  React.useEffect(() => {
    if (!narrow) setDrawerOpen(false);
  }, [narrow]);

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--canvas)",
        color: "var(--text)",
        // The design drives table row padding and page gutters from these, and
        // tightens the gutter on narrow screens.
        ["--rp" as string]: "5px",
        ["--pad" as string]: narrow ? "14px" : "24px",
      }}
    >
      {!narrow ? (
        <div style={{ flexShrink: 0 }}>
          <Sidebar projectId={sidebarProjectId} />
        </div>
      ) : null}

      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          borderLeft: "1px solid var(--line)",
        }}
      >
        {narrow ? (
          <ShellHeaderNarrow
            accountEmail={session?.user?.email}
            crumb={crumb}
            drawerOpen={drawerOpen}
            onOpenDrawer={() => setDrawerOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        ) : (
          <ShellHeaderWide
            siteLabel={siteLabel}
            crumb={crumb}
            onOpenPalette={() => setPaletteOpen(true)}
            accountEmail={session?.user?.email}
          />
        )}

        <SeoApiStatusBanners
          shouldShowSeoApiWarning={shouldShowSeoApiWarning}
          seoApiKeyStatusError={seoApiKeyStatusError}
        />

        {banner}

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {children}
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        projectId={sidebarProjectId}
        onClose={() => setPaletteOpen(false)}
      />

      <MobileSidebarDrawer
        open={drawerOpen}
        projectId={sidebarProjectId}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
