import { describe, expect, it } from "vitest";

import type {
  Ga4RunReportRequest,
  Ga4RunReportResponse,
} from "@/server/lib/ga4Client";
import { Ga4MalformedResponseError } from "@/server/lib/ga4Errors";
import { normalizeGa4Response } from "./Ga4ReportNormalization";

const request: Ga4RunReportRequest = {
  dateRanges: [{ startDate: "2026-08-01", endDate: "2026-08-14" }],
  dimensions: [],
  metrics: [{ name: "sessions" }, { name: "activeUsers" }],
  offset: "0",
  limit: "10",
  orderBys: [],
  keepEmptyRows: false,
  returnPropertyQuota: true,
};

describe("normalizeGa4Response", () => {
  it("treats a bare response from an unprocessed property as an empty report", () => {
    // Production shape from a property created the same day: Google answers
    // with NO headers and NO rows. This must normalize, not throw — throwing
    // rendered INTERNAL_ERROR on the dashboard for a healthy new property.
    const response: Ga4RunReportResponse = {};
    const normalized = normalizeGa4Response(response, request);
    expect(normalized.rows).toEqual([]);
    expect(normalized.totalRowCount).toBe(0);
    expect(normalized.reportMetadata.emptyReason).toBeTruthy();
  });

  it("still rejects a response whose headers disagree with the request", () => {
    const response: Ga4RunReportResponse = {
      dimensionHeaders: [],
      metricHeaders: [{ name: "sessions" }],
      rows: [],
    };
    expect(() => normalizeGa4Response(response, request)).toThrow(
      Ga4MalformedResponseError,
    );
  });
});
