import { describe, expect, it } from "vitest";
import type { ItemRow } from "../newOrderForm";
import { computeOrderTotals } from "./computeOrderTotals";

const row = (price: string, quantity: string): ItemRow => ({ productName: "x", price, quantity });

describe("computeOrderTotals", () => {
  it("returns zero totals for no items", () => {
    expect(computeOrderTotals([])).toEqual({ totalCents: 0, units: 0 });
  });

  it("sums price in cents times quantity and the quantities as units", () => {
    expect(computeOrderTotals([row("12,5", "2"), row("3", "1")])).toEqual({
      totalCents: 2800,
      units: 3,
    });
  });

  it("parses thousands separators in the price", () => {
    expect(computeOrderTotals([row("1.234,5", "2")])).toEqual({ totalCents: 246900, units: 2 });
  });

  it("skips the price of a row with an invalid price but still counts its units", () => {
    expect(computeOrderTotals([row("abc", "4"), row("2", "1")])).toEqual({
      totalCents: 200,
      units: 5,
    });
  });

  it("skips the price and units of a row with an invalid quantity", () => {
    expect(computeOrderTotals([row("9", "0"), row("9", ""), row("1", "3")])).toEqual({
      totalCents: 300,
      units: 3,
    });
  });
});
