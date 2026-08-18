import { Link } from "@tanstack/react-router";
import type { LinkOptions } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Settings, X } from "lucide-react";
import { toast } from "sonner";
import {
  connectNavGroup,
  getProjectNavGroups,
} from "@/client/navigation/items";
import { Icon, type IconName } from "@/client/components/icons/IconSprite";
import { ProjectSwitcher } from "@/client/features/projects/ProjectSwitcher";
import { ThemePreferenceMenuItems } from "@/client/components/ThemePreferenceMenuItems";
import { useThemePreference } from "@/client/lib/theme";
import { closeDropdown } from "@/client/lib/dropdown";
import { signOutAndRedirect, useSession } from "@/lib/auth-client";
import { isHostedClientAuthMode } from "@/lib/auth-mode";

interface SidebarProps {
  projectId: string | null;
  onNavigate?: () => void;
  onClose?: () => void;
}

// Prominence nav item. The design fills hover and active identically with
// var(--inset); what distinguishes them is the 3px accent bar on the active
// item, so the hover tint deliberately does NOT get its own lighter shade.
const navItemBaseClass =
  "prominence-nav-item relative flex items-center gap-2.5 rounded-md text-[13px]";

const navItemClass = navItemBaseClass;

const navItemActiveProps = {
  className: "prominence-nav-item-active",
};

function SidebarNavLink({
  icon,
  label,
  onNavigate,
  linkProps,
}: {
  icon: IconName;
  label: string;
  onNavigate?: () => void;
  linkProps: LinkOptions;
}) {
  return (
    <Link
      onClick={onNavigate}
      activeOptions={{ exact: false, includeSearch: false }}
      {...linkProps}
      className={navItemClass}
      activeProps={navItemActiveProps}
    >
      {/* The bar renders unconditionally and is coloured by the active class,
          so selection never reflows the row. */}
      <span className="prominence-nav-bar" />
      <Icon name={icon} size={15} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({ projectId, onNavigate, onClose }: SidebarProps) {
  const navGroups = [
    ...(projectId ? getProjectNavGroups(projectId) : []),
    connectNavGroup,
  ];

  return (
    <div
      className="flex h-full flex-col"
      style={{
        width: 224,
        background: "var(--canvas)",
        borderRight: "1px solid var(--line)",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: "12px 14px 8px" }}
      >
        <Link
          to="/"
          onClick={onNavigate}
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--text)",
          }}
        >
          UpgradeSEO
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <ThemeToggleButton />
        )}
      </div>

      <div style={{ padding: "0 10px 8px", position: "relative" }}>
        <ProjectSwitcher
          activeProjectId={projectId}
          onCloseDrawer={onNavigate}
        />
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ padding: "8px 8px 14px" }}
      >
        {navGroups.map((group) => (
          <div key={group.label} className="prominence-nav-group">
            <div className="prominence-nav-group-label">{group.label}</div>
            {group.items.map((item) => {
              const { icon, label, ...linkProps } = item;
              return (
                <SidebarNavLink
                  key={linkProps.to}
                  icon={icon}
                  label={label}
                  onNavigate={onNavigate}
                  linkProps={linkProps}
                />
              );
            })}
          </div>
        ))}
      </nav>

      <SidebarFooter onNavigate={onNavigate} />
    </div>
  );
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const isHostedMode = isHostedClientAuthMode();
  const email = session?.user?.email;

  const closeMenu = () => {
    closeDropdown();
    onNavigate?.();
  };

  return (
    <div className="shrink-0 border-t border-base-300 px-2 py-2 pb-safe">
      <SidebarNavLink
        icon="i-help"
        label="Help & Community"
        onNavigate={onNavigate}
        linkProps={{ to: "/support" }}
      />

      {email ? (
        <div className="dropdown dropdown-top w-full">
          <button
            type="button"
            tabIndex={0}
            className={`${navItemClass} w-full`}
            aria-label="Open account menu"
          >
            <Icon name="i-user" size={15} />
            <span className="truncate" data-ph-mask>
              {email}
            </span>
          </button>
          <ul
            tabIndex={0}
            className="dropdown-content z-30 menu mb-1 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
          >
            <li>
              <Link to="/settings" onClick={closeMenu}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </li>
            <ThemePreferenceMenuItems />
            {isHostedMode ? (
              <>
                <li
                  aria-hidden
                  className="pointer-events-none my-1 h-px bg-base-300 p-0"
                />
                <li>
                  <button
                    type="button"
                    className="text-error"
                    onClick={() => signOutAndRedirect()}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </li>
              </>
            ) : null}
          </ul>
        </div>
      ) : (
        <SidebarNavLink
          icon="i-plug"
          label="Settings"
          onNavigate={onNavigate}
          linkProps={{ to: "/settings" }}
        />
      )}
    </div>
  );
}

/**
 * The brand-row theme toggle.
 *
 * The design labels this with its DESTINATION ("Dark" while you are in light),
 * not the current state — the less ambiguous of the two conventions, and the
 * one the design chose.
 *
 * It flips between light and dark only, and it branches on the RESOLVED theme,
 * so pressing it while on "System" pins the opposite of what is on screen. That
 * costs the user their System preference, so the pinning is announced with a
 * one-click way back rather than happening silently.
 */
function ThemeToggleButton() {
  const { themePreference, setThemePreference } = useThemePreference();
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const isDark =
    themePreference === "dark" || (themePreference === "system" && systemDark);

  const handleToggle = () => {
    const next = isDark ? "light" : "dark";
    setThemePreference(next);

    // Pressing this while on "System" replaces a preference that follows the
    // OS with a fixed one. Announce that, and offer the way back, so a single
    // click cannot discard the setting without the user noticing.
    if (themePreference === "system") {
      toast(`Theme pinned to ${next === "dark" ? "dark" : "light"}`, {
        description: "It no longer follows your device.",
        action: {
          label: "Use System",
          onClick: () => setThemePreference("system"),
        },
      });
    }
  };

  return (
    <button
      type="button"
      className="prominence-theme-toggle"
      title="Toggle theme"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      onClick={handleToggle}
    >
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
