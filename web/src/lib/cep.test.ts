import { describe, expect, it } from "vitest";
import { maskCep, stripCep } from "./cep";

describe("cep", () => {
  it("strips everything but digits, capped at 8", () => {
    expect(stripCep("01310-100")).toBe("01310100");
    expect(stripCep("01310100999")).toBe("01310100");
    expect(stripCep("abc")).toBe("");
  });

  it("masks progressively", () => {
    expect(maskCep("01310100")).toBe("01310-100");
    expect(maskCep("0131")).toBe("0131");
    expect(maskCep("013101")).toBe("01310-1");
    expect(maskCep("")).toBe("");
  });

  it("round-trips a masked display value back to exactly 8 digits", () => {
    for (const typed of ["01310-100", "01310100", "01.310-100", " 01310-100 "]) {
      const digits = stripCep(typed);
      expect(digits).toBe("01310100");
      expect(digits).toHaveLength(8);
      expect(stripCep(maskCep(digits))).toBe(digits);
      expect(stripCep(maskCep(digits))).toHaveLength(8);
    }
  });

  it("never lets a mask character reach the wire", () => {
    expect(stripCep(maskCep(stripCep("01001-000")))).toBe("01001000");
    expect(stripCep(maskCep(stripCep("01001-000")))).not.toContain("-");
  });
});
