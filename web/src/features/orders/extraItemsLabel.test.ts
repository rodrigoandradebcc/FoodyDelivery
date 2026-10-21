import { describe, expect, it } from "vitest";
import { extraItemsLabel } from "./extraItemsLabel";

describe("extraItemsLabel", () => {
  it("uses the singular for one item", () => {
    expect(extraItemsLabel(1)).toBe("+1 item");
  });

  it("uses the plural otherwise", () => {
    expect(extraItemsLabel(0)).toBe("+0 itens");
    expect(extraItemsLabel(3)).toBe("+3 itens");
  });
});
