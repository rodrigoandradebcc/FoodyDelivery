import { describe, expect, it } from "vitest";
import { greetingFor } from "./greeting";

function at(hour: number) {
  return new Date(2026, 9, 21, hour, 0, 0);
}

describe("greetingFor", () => {
  it.each([
    [4, "Boa noite"],
    [5, "Bom dia"],
    [11, "Bom dia"],
    [12, "Boa tarde"],
    [17, "Boa tarde"],
    [18, "Boa noite"],
  ])("greets hour %i with %s", (hour, expected) => {
    expect(greetingFor(at(hour)).salutation).toBe(expected);
  });

  it("formats the date in pt-BR", () => {
    expect(greetingFor(at(9)).date).toBe("quarta-feira, 21 de outubro");
  });
});
