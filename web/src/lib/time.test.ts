import { afterEach, describe, expect, it, vi } from "vitest";
import { formatLocalDateTime, formatRelative } from "./time";

describe("formatLocalDateTime", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the browser local timezone and pt-BR date and time", () => {
    vi.stubEnv("TZ", "America/Belem");
    expect(formatLocalDateTime("2026-10-17T01:30:00Z")).toBe("16/10/2026, 22:30");
  });

  it("returns an empty string for invalid dates", () => {
    expect(formatLocalDateTime("invalid")).toBe("");
  });
});

describe("formatRelative", () => {
  it("keeps relative time for a recent order", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
      expect(formatRelative("2026-10-17T11:55:00Z")).toBe("há 5 minutos");
    } finally {
      vi.useRealTimers();
    }
  });
});
