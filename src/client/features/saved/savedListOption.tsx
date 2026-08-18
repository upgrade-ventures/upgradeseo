import { useState, type CSSProperties, type ReactNode } from "react";

import { useFocusRing } from "@/client/features/saved/savedParts";

/** Compact group label: the design's own table-head treatment. */
export const GROUP_LABEL: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: 5,
};

/** One selectable list. A toggle, so it reports its state with aria-pressed. */
export function OptionRow({
  pressed,
  onClick,
  leading,
  trailing,
  children,
}: {
  pressed?: boolean;
  onClick: () => void;
  leading: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const { focusRing, focusProps } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...focusProps}
      className="max-sm:min-h-11"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        minHeight: 28,
        padding: "5px 10px",
        border: "none",
        borderRadius: 0,
        background: pressed
          ? "var(--accent-soft)"
          : hovered
            ? "var(--subtle)"
            : "transparent",
        color: "inherit",
        font: "inherit",
        fontSize: 12.5,
        textAlign: "left",
        cursor: "pointer",
        outline: "none",
        boxShadow: focusRing,
      }}
    >
      {leading}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
      {trailing}
    </button>
  );
}
