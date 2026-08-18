import { z } from "zod";

const ERROR_CODES = [
  "UNAUTHENTICATED",
  "AUTH_CONFIG_MISSING",
  "FORBIDDEN",
  "NOT_FOUND",
  "AUDIT_CAPACITY_REACHED",
  "AUDIT_PAGE_LIMIT_EXCEEDED",
  "AUDIT_ALREADY_RUNNING",
  "VALIDATION_ERROR",
  "CRAWL_TARGET_BLOCKED",
  "PROVIDER_AUTH_FAILED",
  "DATA_SOURCE_NOT_CONFIGURED",
  "RATE_LIMITED",
  "UPSTREAM_UNAVAILABLE",
  "CONFLICT",
  "INTERNAL_ERROR",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

const NON_REPORTABLE_ERROR_CODES = new Set<ErrorCode>([
  "UNAUTHENTICATED",
  "DATA_SOURCE_NOT_CONFIGURED",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "AUDIT_CAPACITY_REACHED",
  "AUDIT_PAGE_LIMIT_EXCEEDED",
  "AUDIT_ALREADY_RUNNING",
]);

export function isErrorCode(value: string): value is ErrorCode {
  return errorCodeSchema.safeParse(value).success;
}

export function shouldCaptureAppErrorCode(
  code: ErrorCode | null | undefined,
): boolean {
  return code == null || !NON_REPORTABLE_ERROR_CODES.has(code);
}
