import { describe, expect, it, vi } from "vitest";
import {
  measureBrandVisibility,
  mentionsTarget,
  normaliseCategory,
} from "./founderyVisibility";

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));

vi.mock("ai", () => ({ generateText: generateTextMock }));
vi.mock("@/server/features/provider-keys/providerKeys", () => ({
  resolveProviderKey: vi.fn(async () => ({
    secret: "test-key",
    publicIdentifier: null,
  })),
}));

function reply(text: string) {
  return { text, usage: { outputTokens: 10 } };
}

describe("mentionsTarget", () => {
  it("matches a domain by its brand label as well as its full host", () => {
    expect(mentionsTarget("Ahrefs is popular.", "ahrefs.com", "domain")).toBe(
      true,
    );
    expect(
      mentionsTarget("See ahrefs.com for more.", "ahrefs.com", "domain"),
    ).toBe(true);
    expect(mentionsTarget("Try Semrush instead.", "ahrefs.com", "domain")).toBe(
      false,
    );
  });

  it("does not fire on the label buried inside a longer word", () => {
    expect(mentionsTarget("moziliation", "moz.com", "domain")).toBe(false);
  });
});

describe("normaliseCategory", () => {
  it("strips quoting and rejects a non-answer", () => {
    expect(normaliseCategory(' "SEO tools." ')).toBe("SEO tools");
    expect(normaliseCategory("UNKNOWN")).toBeNull();
    expect(normaliseCategory("I am sorry, ".repeat(10))).toBeNull();
  });
});

describe("measureBrandVisibility", () => {
  it("never names the target in a probe, and excludes failed probes from the rate", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const probePrompts: string[] = [];

    generateTextMock.mockImplementation(
      async ({ prompt }: { prompt: string }) => {
        if (prompt.includes("what category")) return reply("seo tools");
        probePrompts.push(prompt);
        // Two probes break: they must not be scored as "the model omitted the
        // brand", which is what makes the denominator interesting.
        if (prompt.includes("tight budget") || prompt.includes("shortlist")) {
          throw new Error("upstream boom");
        }
        if (
          prompt.includes("available today") ||
          prompt.includes("professionals")
        ) {
          return reply("Ahrefs is the one most people land on.");
        }
        return reply("Semrush and Moz are the usual answers.");
      },
    );

    const result = await measureBrandVisibility({
      organizationId: "org_1",
      target: "ahrefs.com",
      targetType: "domain",
    });

    expect(probePrompts).toHaveLength(6);
    expect(probePrompts.some((p) => /ahrefs/i.test(p))).toBe(false);

    expect(result).toMatchObject({
      status: "measured",
      category: "seo tools",
      probeCount: 4,
      mentionedCount: 2,
      mentionRatePct: 50,
    });
  });

  it("excludes an empty answer from the rate rather than scoring it a miss", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    generateTextMock.mockImplementation(
      async ({ prompt }: { prompt: string }) =>
        prompt.includes("what category")
          ? reply("seo tools")
          : reply(prompt.includes("well known") ? "Ahrefs and Semrush." : ""),
    );

    const result = await measureBrandVisibility({
      organizationId: "org_1",
      target: "ahrefs.com",
      targetType: "domain",
    });

    expect(result).toMatchObject({
      status: "measured",
      probeCount: 1,
      mentionedCount: 1,
    });
  });

  it("ignores the brand label once the category contains it", async () => {
    generateTextMock.mockImplementation(
      async ({ prompt }: { prompt: string }) =>
        prompt.includes("what category")
          ? reply("travel booking sites")
          : reply(
              prompt.includes("well known")
                ? "Booking.com and Expedia."
                : // "booking" here is the question echoed back, not the brand.
                  "Compare booking options before you commit.",
            ),
    );

    const result = await measureBrandVisibility({
      organizationId: "org_1",
      target: "booking.com",
      targetType: "domain",
    });

    expect(result).toMatchObject({
      status: "measured",
      probeCount: 6,
      mentionedCount: 1,
    });
  });

  it("refuses to measure a target whose name is its own category", async () => {
    generateTextMock.mockResolvedValue(reply("travel booking sites"));

    const result = await measureBrandVisibility({
      organizationId: "org_1",
      target: "booking",
      targetType: "keyword",
    });

    expect(result).toMatchObject({
      status: "unavailable",
      kind: "name_is_category",
    });
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("reports an unrecognised target as unavailable instead of probing", async () => {
    generateTextMock.mockResolvedValue(reply("UNKNOWN"));

    const result = await measureBrandVisibility({
      organizationId: "org_1",
      target: "notarealbrandxyz.com",
      targetType: "domain",
    });

    expect(result).toMatchObject({
      status: "unavailable",
      kind: "unrecognised",
    });
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });
});
