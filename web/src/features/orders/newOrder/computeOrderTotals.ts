import { parsePriceCents, parseQuantity } from "../neworderValidation";
import type { ItemRow } from "../newOrderForm";

export interface OrderTotals {
  totalCents: number;
  units: number;
}

export function computeOrderTotals(items: ItemRow[]): OrderTotals {
  let totalCents = 0;
  let units = 0;
  for (const row of items) {
    const cents = parsePriceCents(row?.price ?? "");
    const qty = parseQuantity(row?.quantity ?? "");
    if (qty !== null) units += qty;
    if (cents !== null && qty !== null) totalCents += cents * qty;
  }
  return { totalCents, units };
}
