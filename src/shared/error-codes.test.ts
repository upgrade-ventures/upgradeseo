import { describe, expect, it } from "vitest";
import { shouldCaptureAppErrorCode } from "@/shared/error-codes";

describe("shouldCaptureAppErrorCode", () => {
  it.each([
    "UNAUTHENTICATED",
    "NOT_FOUND",
    "VALIDATION_ERROR",
    "AUDIT_CAPACITY_REACHED",
    "AUDIT_PAGE_LIMIT_EXCEEDED",
    "AUDIT_ALREADY_RUNNING",
  ] as const)("skips expected %s errors", (code) => {
    expect(shouldCaptureAppErrorCode(code)).toBe(false);
  });

  it("captures unexpected errors and unknown failures", () => {
    expect(shouldCaptureAppErrorCode("INTERNAL_ERROR")).toBe(true);
    expect(shouldCaptureAppErrorCode(undefined)).toBe(true);
    // A provider rejecting our key is a real platform problem — keep it
    // reportable rather than suppressing it as user error.
    expect(shouldCaptureAppErrorCode("PROVIDER_AUTH_FAILED")).toBe(true);
  });
});
