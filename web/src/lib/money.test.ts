import { describe, expect, it } from "vitest";
import { formatCentsBRL, parseBRLToCents } from "./money";

describe("formatCentsBRL", () => {
  it("formats integer cents as BRL", () => {
    expect(formatCentsBRL(123456)).toBe("R$ 1.234,56");
    expect(formatCentsBRL(5)).toBe("R$ 0,05");
    expect(formatCentsBRL(0)).toBe("R$ 0,00");
    expect(formatCentsBRL(100)).toBe("R$ 1,00");
  });
});

describe("parseBRLToCents", () => {
  it("parses pt-BR money strings into integer cents", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("R$ 12,50")).toBe(1250);
    expect(parseBRLToCents("12")).toBe(1200);
    expect(parseBRLToCents("0,5")).toBe(50);
  });

  it("is float-safe: never loses a cent to binary rounding", () => {
    expect(parseBRLToCents("49,90")).toBe(4990);
    expect(parseBRLToCents("1,15")).toBe(115);
    expect(parseBRLToCents("2,29")).toBe(229);
    expect(parseBRLToCents("8,20")).toBe(820);
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    for (const input of ["49,90", "1,15", "2,29", "8,20", "1.234,56"]) {
      expect(Number.isInteger(parseBRLToCents(input))).toBe(true);
    }
  });

  it("round-trips format -> parse for float-hostile values", () => {
    for (const cents of [4990, 115, 229, 820, 123456, 5, 100, 999999]) {
      expect(parseBRLToCents(formatCentsBRL(cents))).toBe(cents);
    }
  });

  it("rejects garbage", () => {
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("")).toBeNull();
    expect(parseBRLToCents("1,2,3")).toBeNull();
    expect(parseBRLToCents("-5")).toBeNull();
  });
});
