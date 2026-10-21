import { describe, expect, it } from "vitest";
import { isStatus, TABS } from "./orderTabs";

describe("isStatus", () => {
  it("accepts every tab status", () => {
    for (const status of TABS) expect(isStatus(status)).toBe(true);
  });

  it("rejects null and unknown values", () => {
    expect(isStatus(null)).toBe(false);
    expect(isStatus("")).toBe(false);
    expect(isStatus("INVALIDO")).toBe(false);
  });
});
