import { useState } from "react";
import type { OrderResponse } from "../../api/types";
import { maskCep } from "../../lib/cep";
import { formatCentsBRL } from "../../lib/money";
import { formatRelative } from "../../lib/time";
import { ADVANCE_LABEL, CAN_CANCEL, NEXT_STATUS } from "./statusMeta";
import { useStatusMutation } from "./useOrders";

export function OrderCard({
  order,
  notify,
}: {
  order: OrderResponse;
  notify: (msg: string) => void;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const mutation = useStatusMutation((e) => {
    notify(e.status === 409 ? "Transição inválida — o quadro foi atualizado." : e.message);
  });

  const next = NEXT_STATUS[order.status];
  const advanceLabel = ADVANCE_LABEL[order.status];
  const canCancel = CAN_CANCEL[order.status];
  const addr = order.deliveryAddress;
  const [first, ...rest] = order.items;
  const busy = mutation.isPending;

  return (
    <article className="order-card card">
      <header className="order-card-top">
        <span className="mono order-id" title={order.id}>
          #{order.id.slice(0, 8)}
        </span>
        <time className="order-time" dateTime={order.createdAt}>
          {formatRelative(order.createdAt)}
        </time>
      </header>

      <p className="order-summary">
        {first?.quantity}× {first?.productName}
        {rest.length > 0 && (
          <span className="order-more">
            {" "}
            +{rest.length} {rest.length === 1 ? "item" : "itens"}
          </span>
        )}
      </p>
      <p className="order-place">
        {addr.district} · {addr.city}
      </p>

      <details className="order-details">
        <summary>Detalhes</summary>
        <ul className="order-items">
          {order.items.map((item, i) => (
            <li key={`${item.productName}-${i}`}>
              <span>
                {item.quantity}× {item.productName}
              </span>
              <span className="mono">
                {formatCentsBRL(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <p className="order-address">
          {addr.street}, {addr.number}
          {addr.complement ? ` — ${addr.complement}` : ""}
          <br />
          {addr.district}, {addr.city} — {addr.state} · CEP {maskCep(addr.zipCode)}
        </p>
      </details>

      <footer className="order-card-bottom">
        <strong className="mono order-total">{formatCentsBRL(order.totalCents)}</strong>
        {(next || canCancel) &&
          (confirmingCancel ? (
            <div className="order-actions" role="group" aria-label="Confirmar cancelamento">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={busy}
                onClick={() => setConfirmingCancel(false)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary order-cancel-confirm"
                disabled={busy}
                onClick={() =>
                  mutation.mutate(
                    { id: order.id, status: "CANCELADO" },
                    { onSettled: () => setConfirmingCancel(false) },
                  )
                }
              >
                {busy ? "Cancelando…" : "Confirmar cancelamento"}
              </button>
            </div>
          ) : (
            <div className="order-actions">
              {canCancel && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger-ghost"
                  disabled={busy}
                  onClick={() => setConfirmingCancel(true)}
                >
                  Cancelar
                </button>
              )}
              {next && advanceLabel && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={busy}
                  onClick={() => mutation.mutate({ id: order.id, status: next })}
                >
                  {busy ? "Salvando…" : advanceLabel}
                </button>
              )}
            </div>
          ))}
      </footer>
    </article>
  );
}
