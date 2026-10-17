import { describe, expect, it } from "vitest";
import type { PageResponse } from "../../api/types";
import { flattenOrderPages, nextOrdersPage } from "./useOrders";

function page(number: number, totalPages: number, ids: string[]): PageResponse<{ id: string }> {
  return {
    page: number,
    size: 100,
    totalElements: ids.length,
    totalPages,
    content: ids.map((id) => ({ id })),
  };
}

describe("order pages", () => {
  it("advances using the API page number until the final page", () => {
    expect(nextOrdersPage(page(0, 3, ["a"]))).toBe(1);
    expect(nextOrdersPage(page(1, 3, ["b"]))).toBe(2);
    expect(nextOrdersPage(page(2, 3, ["c"]))).toBeUndefined();
    expect(nextOrdersPage(page(0, 0, []))).toBeUndefined();
  });

  it("keeps all loaded orders in page order", () => {
    expect(flattenOrderPages([page(0, 2, ["new", "middle"]), page(1, 2, ["old"])]).map((order) => order.id)).toEqual([
      "new",
      "middle",
      "old",
    ]);
    expect(flattenOrderPages([])).toEqual([]);
  });
});
