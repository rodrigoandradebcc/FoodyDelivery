import { describe, expect, it } from "vitest";
import {
  parsePriceCents,
  parseQuantity,
  toFormErrorTarget,
  validateComplement,
  validateItemCount,
  validateRequiredText,
  validateState,
  validateZipCode,
} from "./neworderValidation";

describe("new order validation", () => {
  it("validates trimmed required text and optional complement", () => {
    expect(validateRequiredText("  ", "o cliente")).toBe("Informe o cliente.");
    expect(validateRequiredText(` ${"a".repeat(120)} `, "o cliente")).toBe(true);
    expect(validateRequiredText("a".repeat(121), "o cliente")).not.toBe(true);
    expect(validateComplement(" ")).toBe(true);
    expect(validateComplement("a".repeat(121))).not.toBe(true);
  });

  it("limits item count to 1 through 100", () => {
    expect(validateItemCount(0)).not.toBe(true);
    expect(validateItemCount(1)).toBe(true);
    expect(validateItemCount(100)).toBe(true);
    expect(validateItemCount(101)).not.toBe(true);
  });

  it("accepts only whole quantities from 1 through 1000", () => {
    expect(parseQuantity("1")).toBe(1);
    expect(parseQuantity("1000")).toBe(1000);
    for (const value of ["0", "1001", "1.5", "1e2", "01x", "", "-1"]) {
      expect(parseQuantity(value)).toBeNull();
    }
  });

  it("parses reais exactly to bounded cents", () => {
    expect(parsePriceCents("0")).toBe(0);
    expect(parsePriceCents("45,9")).toBe(4590);
    expect(parsePriceCents("1.000.000,00")).toBe(100_000_000);
    expect(parsePriceCents("1000000")).toBe(100_000_000);
    for (const value of ["1.000.000,01", "1,234", "1.5", "-1", "", "1e2", "01x"]) {
      expect(parsePriceCents(value)).toBeNull();
    }
  });

  it("validates state letters and eight zip digits", () => {
    expect(validateState("PA")).toBe(true);
    expect(validateState("P1")).not.toBe(true);
    expect(validateState("PAR")).not.toBe(true);
    expect(validateZipCode("66000000")).toBe(true);
    expect(validateZipCode("66000-000")).not.toBe(true);
    expect(validateZipCode("6600000a")).not.toBe(true);
  });
});

describe("server field mapping", () => {
  it("maps customer, collection, item, and address errors", () => {
    expect(toFormErrorTarget("customerName")).toBe("customerName");
    expect(toFormErrorTarget("items")).toBe("items.root");
    expect(toFormErrorTarget("items[2].unitPriceCents")).toBe("items.2.price");
    expect(toFormErrorTarget("items[0].productName")).toBe("items.0.productName");
    expect(toFormErrorTarget("items[1].quantity")).toBe("items.1.quantity");
    expect(toFormErrorTarget("deliveryAddress")).toBe("deliveryAddress.root");
    expect(toFormErrorTarget("deliveryAddress.zipCode")).toBe("deliveryAddress.zipCode");
    expect(toFormErrorTarget("deliveryAddress.complement")).toBe("deliveryAddress.complement");
    expect(toFormErrorTarget("deliveryAddress.district")).toBe("deliveryAddress.district");
  });

  it("uses form-level fallback only for unknown paths", () => {
    expect(toFormErrorTarget("items[0].unknown")).toBeNull();
    expect(toFormErrorTarget("items[0].name")).toBeNull();
    expect(toFormErrorTarget("deliveryAddress.unknown")).toBeNull();
    expect(toFormErrorTarget("deliveryAddress.neighborhood")).toBeNull();
    expect(toFormErrorTarget("status")).toBeNull();
  });
});
