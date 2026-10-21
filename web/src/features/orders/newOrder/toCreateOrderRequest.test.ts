import { describe, expect, it } from "vitest";
import type { NewOrderForm } from "../newOrderForm";
import { toCreateOrderRequest } from "./toCreateOrderRequest";

function form(overrides: Partial<NewOrderForm> = {}): NewOrderForm {
  return {
    customerName: "  Ana Souza ",
    items: [
      { productName: " Pizza ", price: "45,90", quantity: "2" },
      { productName: "Refrigerante", price: "8", quantity: " 1 " },
    ],
    deliveryAddress: {
      street: " Rua das Flores ",
      number: " 12 ",
      complement: "  ",
      district: " Centro ",
      city: " Belém ",
      state: " pa ",
      zipCode: "66010000",
    },
    ...overrides,
  };
}

describe("toCreateOrderRequest", () => {
  it("trims text, parses cents and quantity, nulls an empty complement and uppercases the UF", () => {
    expect(toCreateOrderRequest(form())).toEqual({
      customerName: "Ana Souza",
      items: [
        { productName: "Pizza", unitPriceCents: 4590, quantity: 2 },
        { productName: "Refrigerante", unitPriceCents: 800, quantity: 1 },
      ],
      deliveryAddress: {
        street: "Rua das Flores",
        number: "12",
        complement: null,
        district: "Centro",
        city: "Belém",
        state: "PA",
        zipCode: "66010000",
      },
    });
  });

  it("keeps a filled complement trimmed", () => {
    const base = form();
    const request = toCreateOrderRequest({
      ...base,
      deliveryAddress: { ...base.deliveryAddress, complement: " Apto 3 " },
    });
    expect(request.deliveryAddress.complement).toBe("Apto 3");
  });
});
