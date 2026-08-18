import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { LOCATION_OPTIONS } from "@/shared/keyword-locations";

type LocationOption = (typeof LOCATION_OPTIONS)[number];

type Props = {
  value: number;
  onChange: (locationCode: number) => void;
  /** Defaults to the full country list. Pass a subset (e.g. Labs-only). */
  options?: readonly LocationOption[];
  /** Width utilities for the wrapper/trigger. Defaults to full width. */
  className?: string;
  /** Put on the trigger, so a visible `<label for>` can name this control. */
  id?: string;
};

function matches(option: LocationOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    option.label.toLowerCase().includes(needle) ||
    option.shortLabel.toLowerCase().includes(needle)
  );
}

/**
 * Searchable country picker. Allows users to filter the country list instead of
 * scrolling it. The scrollable list is preserved below the search input.
 */
export function LocationSelect({
  value,
  onChange,
  options = LOCATION_OPTIONS,
  className = "w-full",
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.code === value) ?? null;

  const filtered = useMemo(
    () => options.filter((option) => matches(option, query)),
    [options, query],
  );

  // Reset transient state and focus the search input each time the menu opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  }, [open]);

  // Close on outside click so it behaves like the surrounding native selects.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !containerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Keep the highlighted option in view as the user arrows through results.
  useEffect(() => {
    if (!open) return;
    const activeItem = listRef.current?.children[activeIndex];
    activeItem?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const select = (option: LocationOption) => {
    onChange(option.code);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Enter": {
        event.preventDefault();
        const option = filtered[activeIndex];
        if (option) select(option);
        break;
      }
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        className="select select-bordered flex w-full items-center justify-between gap-2 text-left font-normal max-sm:min-h-11 focus-visible:outline-none focus-visible:shadow-[var(--focus)]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate">{selected?.label ?? "Select country"}</span>
      </button>

      {open ? (
        <div className="fixed z-30 mt-2 w-full max-w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
          <label className="flex items-center gap-2 rounded-lg border border-base-300 px-3 py-2 focus-within:border-primary">
            <Search className="size-4 shrink-0 text-base-content/50" />
            <input
              ref={inputRef}
              type="text"
              className="grow min-w-0 bg-transparent text-sm outline-none placeholder:text-base-content/60"
              placeholder="Search countries"
              // The placeholder is not an accessible name: it goes away as
              // soon as the user types.
              aria-label="Search countries"
              aria-controls={listboxId}
              aria-activedescendant={
                filtered[activeIndex]
                  ? `${listboxId}-${filtered[activeIndex].code}`
                  : undefined
              }
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
            />
          </label>

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Countries"
            className="menu mt-2 max-h-64 w-full flex-nowrap overflow-y-auto p-0"
          >
            {filtered.length === 0 ? (
              <li className="w-full break-all px-3 py-2 text-sm text-base-content/60">
                No countries match “{query.trim()}”
              </li>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.code === value;
                return (
                  // The option role sits on the button, not the <li>: a
                  // focusable control nested inside an option is not a valid
                  // listbox.
                  <li key={option.code} role="presentation">
                    <button
                      type="button"
                      id={`${listboxId}-${option.code}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`w-full max-sm:min-h-11 focus-visible:outline-none focus-visible:shadow-[var(--focus)] ${index === activeIndex ? "menu-focus" : ""}`}
                      onClick={() => select(option)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className="flex-1 truncate">{option.label}</span>
                      {isSelected ? (
                        <Check className="size-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
