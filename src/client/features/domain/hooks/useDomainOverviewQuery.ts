import { useQuery } from "@tanstack/react-query";
import { getDomainOverview } from "@/serverFunctions/domain";

type Input = {
  projectId: string;
  domain: string;
  includeSubdomains: boolean;
  locationCode: number | undefined;
};

/**
 * The overview payload as the screen receives it. Derived from the server
 * function so the free-stack annotations (`free.unavailable`, `free.source`)
 * cannot drift out of sync with the copy the UI renders.
 */
export type DomainOverview = Awaited<ReturnType<typeof getDomainOverview>>;

export function useDomainOverviewQuery(input: Input) {
  const trimmedDomain = input.domain.trim();

  return useQuery({
    enabled: trimmedDomain !== "",
    queryKey: [
      "domain-overview",
      input.projectId,
      trimmedDomain,
      input.includeSubdomains,
      input.locationCode,
    ],
    queryFn: () =>
      getDomainOverview({
        data: {
          projectId: input.projectId,
          domain: trimmedDomain,
          includeSubdomains: input.includeSubdomains,
          locationCode: input.locationCode,
        },
      }),
    staleTime: 5 * 60_000,
  });
}
