import { useFormContext } from "react-hook-form";
import { LiveTotal } from "./LiveTotal";
import type { NewOrderForm } from "../newOrderForm";

export function OrderSummary({ isSubmitting }: { isSubmitting: boolean }) {
  const { control } = useFormContext<NewOrderForm>();

  return (
    <div className="no-footer">
      <span className="no-footer-title" aria-hidden="true">Comanda</span>
      <LiveTotal control={control} />
      <div className="tear no-tear" aria-hidden="true" />
      <button type="submit" className="btn btn-primary btn-pill btn-lg no-submit" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Criar pedido"}
      </button>
    </div>
  );
}
