import { useEffect, useState, type RefObject } from "react";

/**
 * The design's two breakpoints, in px.
 *
 * These are measured against the SHELL's own width rather than the viewport,
 * which is why they are not CSS media queries: the shell can be embedded (the
 * design doc renders it inside a preview frame) and a viewport query would then
 * describe the wrong box entirely.
 */
const NARROW_MAX = 900;
const MID_MAX = 1140;

/** How often the width is re-read. See the note on polling below. */
const POLL_MS = 250;

type ShellBreakpoint = {
  /** Below 900: sidebar becomes an overlay drawer, compact topbar. */
  narrow: boolean;
  /** Below 1140: detail views collapse to a single column. */
  mid: boolean;
  /** Convenience inverse of `narrow`, matching the design's own `wide` flag. */
  wide: boolean;
};

/**
 * Track the shell's width against the design's breakpoints.
 *
 * Three signals feed this, deliberately: `resize`, a `ResizeObserver`, and a
 * 250ms poll. The poll is not redundant belt-and-braces — the design's own
 * source comments call it "the authoritative trigger", because ResizeObserver
 * and rAF can both be inert inside preview/embed hosts, and a stale breakpoint
 * renders the wrong shell entirely rather than merely misaligning something.
 */
export function useShellBreakpoint(
  ref: RefObject<HTMLElement | null>,
): ShellBreakpoint {
  const [narrow, setNarrow] = useState(false);
  const [mid, setMid] = useState(false);

  useEffect(() => {
    const measure = () => {
      const width = ref.current?.clientWidth ?? window.innerWidth;
      setNarrow(width < NARROW_MAX);
      setMid(width < MID_MAX);
    };

    measure();
    const poll = window.setInterval(measure, POLL_MS);
    window.addEventListener("resize", measure);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    if (observer) {
      observer.observe(document.documentElement);
      observer.observe(document.body);
      if (ref.current) observer.observe(ref.current);
    }

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [ref]);

  return { narrow, mid, wide: !narrow };
}
