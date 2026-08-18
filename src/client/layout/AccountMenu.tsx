import { useEffect, useRef, useState } from "react";

import { Icon } from "@/client/components/icons/IconSprite";
import { type ThemePreference, useThemePreference } from "@/client/lib/theme";
import { signOutAndRedirect } from "@/lib/auth-client";

/**
 * The account control in the top-right corner: who is signed in, the theme
 * toggle, and sign out.
 *
 * Used by the app shell header AND by the onboarding checklist, which renders
 * outside the shell and would otherwise have no account affordance at all.
 * One component so the two cannot drift.
 *
 * Built against the tokens rather than daisyUI: this screen is part of the
 * ported design, and the shared daisyUI dropdown opens purely on
 * `:focus-within`, which leaves nothing truthful to put in `aria-expanded`.
 * Open state is real here, so Escape and an outside click both close it.
 */
export function AccountMenu({ email }: { email: string | undefined }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Focus goes back where it came from, or the menu leaves the keyboard
      // user at the top of the document.
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!email) return null;

  return (
    <div
      ref={rootRef}
      style={{ position: "fixed", top: 14, right: 14, zIndex: 20 }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="prominence-icon-button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          // The class carries only :hover and :focus-visible, as the shell's
          // own icon buttons do; the resting skin is inline.
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: "var(--surface)",
          color: "var(--text-2)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        <Icon name="i-user" size={15} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          style={{
            position: "absolute",
            top: 40,
            right: 0,
            minWidth: 232,
            padding: 6,
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "var(--overlay)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div
            data-ph-mask
            style={{
              padding: "5px 8px 7px",
              fontSize: 12,
              color: "var(--text-2)",
              overflowWrap: "anywhere",
            }}
          >
            {email}
          </div>

          <MenuLink href="/settings">Settings</MenuLink>

          <ThemeChoice onChosen={() => setOpen(false)} />

          <MenuButton
            onClick={() => {
              setOpen(false);
              signOutAndRedirect();
            }}
          >
            Sign out
          </MenuButton>
        </div>
      ) : null}
    </div>
  );
}

const ITEM: React.CSSProperties = {
  display: "block",
  width: "100%",
  minHeight: 32,
  padding: "7px 8px",
  border: "none",
  borderRadius: 6,
  background: "none",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 12.5,
  textAlign: "left",
  textDecoration: "none",
  cursor: "pointer",
};

/**
 * Hover and the focus ring, both of which the design carries outside plain CSS.
 * `:focus-visible` is matched rather than assumed so the ring stays off a
 * mouse click.
 */
function useItemState() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return {
    style: {
      background: hovered || focused ? "var(--subtle)" : "none",
      outline: "none",
      boxShadow: focused ? "var(--focus)" : undefined,
    },
    handlers: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: (event: {
        currentTarget: { matches: (s: string) => boolean };
      }) => setFocused(event.currentTarget.matches(":focus-visible")),
      onBlur: () => setFocused(false),
    },
  };
}

function MenuLink({ href, children }: { href: string; children: string }) {
  const { style, handlers } = useItemState();
  return (
    <a role="menuitem" href={href} {...handlers} style={{ ...ITEM, ...style }}>
      {children}
    </a>
  );
}

function MenuButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: string;
}) {
  const { style, handlers } = useItemState();
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      {...handlers}
      style={{ ...ITEM, ...style }}
    >
      {children}
    </button>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * The same three-way preference the Settings screen offers, in menu form.
 * Choosing closes the menu, so the page it just repainted is what you are
 * looking at.
 */
function ThemeChoice({ onChosen }: { onChosen: () => void }) {
  const { themePreference, setThemePreference } = useThemePreference();
  return (
    <div style={{ padding: "8px 8px 4px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
        id="onboarding-theme-label"
      >
        Theme
      </div>
      <div
        role="radiogroup"
        aria-labelledby="onboarding-theme-label"
        style={{
          display: "flex",
          gap: 2,
          padding: 2,
          marginTop: 5,
          border: "1px solid var(--line)",
          borderRadius: 7,
          background: "var(--subtle)",
        }}
      >
        {THEME_OPTIONS.map((option) => {
          const active = option.value === themePreference;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setThemePreference(option.value);
                onChosen();
              }}
              style={{
                flex: 1,
                minHeight: 26,
                padding: "3px 8px",
                border: "none",
                borderRadius: 5,
                fontFamily: "inherit",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--text)" : "var(--text-2)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
