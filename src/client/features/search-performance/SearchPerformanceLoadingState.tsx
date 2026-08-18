import { Card, ScreenBody } from "@/client/components/prominence/Primitives";
import { MetricStrip } from "@/client/features/search-performance/SearchPerformanceMetricStrip";
import { PerformanceTable } from "@/client/features/search-performance/SearchPerformanceTable";

/**
 * Skeleton for the first load of the Search Performance report.
 *
 * It draws the Queries tab exactly as it will settle — divided metric strip
 * over the queries card — so nothing on the page moves once Google answers.
 */
export function SearchPerformanceLoadingState() {
  return (
    <div aria-busy>
      <MetricStrip totals={null} prevTotals={null} />
      <ScreenBody>
        <Card title="Top queries">
          <PerformanceTable
            variant="card"
            labelHeader="Query"
            rows={[]}
            status="loading"
            emptyMessage=""
          />
        </Card>
      </ScreenBody>
    </div>
  );
}
