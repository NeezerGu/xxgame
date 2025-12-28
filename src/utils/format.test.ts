import { describe, expect, it } from "vitest";
import { formatCompact, formatInt, formatSeconds } from "./format";

describe("formatCompact", () => {
  it("formats values with compact suffixes", () => {
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(1000)).toBe("1K");
    expect(formatCompact(1500)).toBe("1.5K");
    expect(formatCompact(12000)).toBe("12K");
    expect(formatCompact(2_500_000)).toBe("2.5M");
    expect(formatCompact(-1500)).toBe("-1.5K");
  });

  it("handles invalid numbers", () => {
    expect(formatCompact(Number.NaN)).toBe("-");
    expect(formatCompact(Number.POSITIVE_INFINITY)).toBe("-");
  });

  it("applies maxDecimals cap", () => {
    expect(formatCompact(1500, { maxDecimals: 0 })).toBe("2K");
  });
});

describe("formatInt", () => {
  it("floors and formats integers with locale", () => {
    expect(formatInt(1234.9, "en-US")).toBe("1,234");
  });
});

describe("formatSeconds", () => {
  it("rounds and appends seconds", () => {
    expect(formatSeconds(10.4)).toBe("10s");
    expect(formatSeconds(10.5)).toBe("11s");
  });
});
