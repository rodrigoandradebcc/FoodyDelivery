import { describe, expect, it } from "vitest";
import { cardEnterDelayMs } from "./cardEnterDelay";

describe("cardEnterDelayMs", () => {
  it("staggers cards by 30ms each", () => {
    expect(cardEnterDelayMs(0)).toBe(0);
    expect(cardEnterDelayMs(3)).toBe(90);
  });

  it("caps the delay at the eighth card", () => {
    expect(cardEnterDelayMs(8)).toBe(240);
    expect(cardEnterDelayMs(12)).toBe(240);
  });
});
