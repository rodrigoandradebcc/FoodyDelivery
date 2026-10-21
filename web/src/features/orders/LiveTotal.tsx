import { useWatch, type Control } from "react-hook-form";
import { formatCentsBRL } from "../../lib/money";
import type { NewOrderForm } from "./newOrderForm";
import { parsePriceCents, parseQuantity } from "./neworderValidation";

export default function LiveTotal({ control }: { control: Control<NewOrderForm> }) {
  const items = useWatch({ control, name: "items" });
  const rows = items ?? [];
  const totalCents = rows.reduce((sum, row) => {
    const cents = parsePriceCents(row?.price ?? "");
    const qty = parseQuantity(row?.quantity ?? "");
    return cents !== null && qty !== null ? sum + cents * qty : sum;
  }, 0);
  const units = rows.reduce((sum, row) => {
    const qty = parseQuantity(row?.quantity ?? "");
    return qty !== null ? sum + qty : sum;
  }, 0);

  return (
    <div className="no-total-block">
      <span className="no-total-label">
        Total · {units} {units === 1 ? "item" : "itens"}
      </span>
      <strong className="mono no-total">{formatCentsBRL(totalCents)}</strong>
    </div>
  );
}
