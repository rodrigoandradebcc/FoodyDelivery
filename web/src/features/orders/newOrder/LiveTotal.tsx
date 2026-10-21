import { useWatch, type Control } from "react-hook-form";
import { formatCentsBRL } from "../../../lib/money";
import type { NewOrderForm } from "../newOrderForm";
import { computeOrderTotals } from "./computeOrderTotals";

export default function LiveTotal({ control }: { control: Control<NewOrderForm> }) {
  const items = useWatch({ control, name: "items" });
  const { totalCents, units } = computeOrderTotals(items ?? []);

  return (
    <div className="no-total-block">
      <span className="no-total-label">
        Total · {units} {units === 1 ? "item" : "itens"}
      </span>
      <strong className="mono no-total">{formatCentsBRL(totalCents)}</strong>
    </div>
  );
}
