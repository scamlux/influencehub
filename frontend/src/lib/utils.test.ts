import { describe, it, expect } from "vitest";
import { formatNumber, formatUSD, initials, timeAgo, formatDate, normalizeSearch } from "./utils";

describe("normalizeSearch", () => {
  it("matches across Cyrillic and Latin scripts", () => {
    // "Азода" and "Azoda" should normalize to the same token (#5)
    expect(normalizeSearch("Азода")).toBe(normalizeSearch("Azoda"));
    expect(normalizeSearch("Юсупахмет")).toBe("yusupakhmet");
  });

  it("is case- and punctuation-insensitive", () => {
    expect(normalizeSearch("Xo‘jayev")).toBe("xojayev");
    expect(normalizeSearch("Family Travel UZ").includes("familytraveluz")).toBe(true);
  });

  it("supports partial substring lookups", () => {
    expect(normalizeSearch("Khabib Nurmagomedov").includes(normalizeSearch("хабиб"))).toBe(true);
  });
});

describe("formatNumber", () => {
  it("leaves values under 1,000 untouched", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
  });

  it("abbreviates thousands", () => {
    expect(formatNumber(1000)).toBe("1K");
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(12345)).toBe("12.3K");
  });

  it("abbreviates millions", () => {
    expect(formatNumber(1_000_000)).toBe("1M");
    expect(formatNumber(2_500_000)).toBe("2.5M");
  });
});

describe("formatUSD", () => {
  it("formats whole dollars with no fraction", () => {
    expect(formatUSD(29)).toBe("$29");
    expect(formatUSD(1500)).toBe("$1,500");
  });
});

describe("initials", () => {
  it("takes up to two uppercase initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("madonna")).toBe("M");
    expect(initials("Jean Luc Picard")).toBe("JL");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for the current moment", () => {
    expect(timeAgo(new Date())).toBe("just now");
  });

  it("reports hours for an older timestamp", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000);
    expect(timeAgo(threeHoursAgo)).toBe("3h ago");
  });
});

describe("formatDate", () => {
  it("renders an em dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });
});
