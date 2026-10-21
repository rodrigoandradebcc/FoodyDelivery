import { describe, expect, it } from "vitest";
import { isPasswordWithinLimit } from "./passwordBytes";

describe("isPasswordWithinLimit", () => {
  it("accepts ascii up to 72 characters", () => {
    expect(isPasswordWithinLimit("a".repeat(72))).toBe(true);
  });

  it("rejects more than 72 characters", () => {
    expect(isPasswordWithinLimit("a".repeat(73))).toBe(false);
  });

  it("rejects strings under 72 characters that exceed 72 bytes", () => {
    expect(isPasswordWithinLimit("é".repeat(40))).toBe(false);
  });

  it("accepts multibyte strings within 72 bytes", () => {
    expect(isPasswordWithinLimit("é".repeat(36))).toBe(true);
  });
});
