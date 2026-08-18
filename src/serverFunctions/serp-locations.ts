import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { serpLocationsForCountry } from "@/server/lib/free-seo/serp-locations";

/** ISO 3166-1 alpha-2, e.g. "us" — the market table is keyed on it. */
const countryCodeField = z.string().regex(/^[a-z]{2}$/i);

const searchSerpLocationsSchema = z.object({
  query: z.string().min(1).max(100),
  countryCode: countryCodeField,
});

export const searchSerpLocations = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(searchSerpLocationsSchema)
  .handler(({ data }) => {
    const all = serpLocationsForCountry(data.countryCode);
    const needle = data.query.trim().toLowerCase();
    return all
      .filter((loc) => loc.displayLabel.toLowerCase().includes(needle))
      .slice(0, 10);
  });

/**
 * Retained as a no-op so the client's "warm the list before the first
 * keystroke" call still resolves. The free list is a table lookup in the same
 * isolate, so there is no cache left to fill; the call should be dropped from
 * SearchTargetingField and this export with it.
 */
export const prewarmSerpLocations = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(z.object({ countryCode: countryCodeField }))
  .handler(() => ({ warmed: true }));
