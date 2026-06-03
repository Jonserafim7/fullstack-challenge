import { describe, expect, test } from "bun:test";
import { formatCents, formatMultiplier } from "./format";

describe("formatCents", () => {
  test("formats integer cents as pt-BR currency", () => {
    // Assert on the digits/separators (not the exact space after R$, which Intl renders as a
    // non-breaking space) so the test is robust across ICU versions.
    const formatted = formatCents(100_000);
    expect(formatted.startsWith("R$")).toBe(true);
    expect(formatted).toContain("1.000,00");
    expect(formatCents(99)).toContain("0,99");
  });
});

describe("formatMultiplier", () => {
  test("formats with two decimals and an x suffix", () => {
    expect(formatMultiplier(2.47)).toBe("2.47x");
    expect(formatMultiplier(1)).toBe("1.00x");
  });
});
