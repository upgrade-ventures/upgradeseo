import { describe, expect, it } from "vitest";
import { AppError, toClientError } from "@/server/lib/errors";

describe("toClientError", () => {
  it("sanitizes detailed internal error messages", () => {
    const error = toClientError(
      new AppError(
        "INTERNAL_ERROR",
        "Provider task missing response metadata (path: Invalid input). Response: {...}",
      ),
    );

    expect(error.message).toBe("INTERNAL_ERROR");
  });

  it("keeps public error codes unchanged", () => {
    const error = toClientError(new AppError("RATE_LIMITED"));

    expect(error.message).toBe("RATE_LIMITED");
  });

  it("passes setup-error detail through as CODE: detail", () => {
    const error = toClientError(
      new AppError(
        "AUTH_CONFIG_MISSING",
        "TEAM_DOMAIN must be a full https URL like https://your-team.cloudflareaccess.com",
      ),
    );

    expect(error.message).toBe(
      "AUTH_CONFIG_MISSING: TEAM_DOMAIN must be a full https URL like https://your-team.cloudflareaccess.com",
    );
  });

  it("keeps a detail-less setup error as its bare code", () => {
    const error = toClientError(new AppError("AUTH_CONFIG_MISSING"));

    expect(error.message).toBe("AUTH_CONFIG_MISSING");
  });
});
