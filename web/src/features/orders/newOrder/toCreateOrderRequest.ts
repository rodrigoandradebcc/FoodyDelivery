import type { CreateOrderRequest } from "../../../api/types";
import type { NewOrderForm } from "../newOrderForm";
import { parsePriceCents, parseQuantity } from "../neworderValidation";

export function toCreateOrderRequest(form: NewOrderForm): CreateOrderRequest {
  const addr = form.deliveryAddress;
  const complement = addr.complement.trim();
  return {
    customerName: form.customerName.trim(),
    items: form.items.map((row) => ({
      productName: row.productName.trim(),
      unitPriceCents: parsePriceCents(row.price)!,
      quantity: parseQuantity(row.quantity)!,
    })),
    deliveryAddress: {
      street: addr.street.trim(),
      number: addr.number.trim(),
      complement: complement === "" ? null : complement,
      district: addr.district.trim(),
      city: addr.city.trim(),
      state: addr.state.trim().toUpperCase(),
      zipCode: addr.zipCode,
    },
  };
}
