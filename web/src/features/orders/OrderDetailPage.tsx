import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ApiError } from "../../api/http";
import { getOrder } from "../../api/orders";
import { maskCep } from "../../lib/cep";
import { formatCentsBRL } from "../../lib/money";
import { formatLocalDateTime } from "../../lib/time";
import { ADVANCE_LABEL, CAN_CANCEL, NEXT_STATUS, STATUS_META } from "./statusMeta";
import { useStatusMutation } from "./useOrders";
import "./orderdetail.css";

export default function OrderDetailPage() {
  const { id } = useParams();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => getOrder(id ?? ""),
    enabled: Boolean(id),
  });
  const mutation = useStatusMutation((error) => {
    setMutationError(
      error.status === 409 ? "Transição inválida — o pedido foi atualizado." : error.message,
    );
  });
  const order = query.data;

  if (query.isPending) {
    return <p className="detail-state" role="status">Carregando pedido…</p>;
  }

  if (query.isError || !order) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="detail-state">
        <h1>{notFound ? "Pedido não encontrado" : "Não foi possível carregar o pedido"}</h1>
        {!notFound && (
          <>
            <p>{query.error instanceof Error ? query.error.message : "Tente novamente."}</p>
            <button type="button" className="btn btn-ghost" onClick={() => query.refetch()}>
              Tentar de novo
            </button>
          </>
        )}
        <Link className="no-back" to="/">Voltar aos pedidos</Link>
      </div>
    );
  }

  const meta = STATUS_META[order.status];
  const next = NEXT_STATUS[order.status];
  const advanceLabel = ADVANCE_LABEL[order.status];
  const canCancel = CAN_CANCEL[order.status];
  const address = order.deliveryAddress;
  const busy = mutation.isPending;
  const orderId = order.id;

  function changeStatus(status: "CANCELADO" | NonNullable<typeof next>) {
    setMutationError(null);
    mutation.mutate(
      { id: orderId, status },
      { onSettled: () => setConfirmingCancel(false) },
    );
  }

  return (
    <div className="order-detail">
      <Link className="no-back" to="/">Voltar aos pedidos</Link>
      <header className="detail-header">
        <div>
          <p className="detail-id mono">Pedido #{order.id}</p>
          <h1>{order.customerName}</h1>
        </div>
        <span className="badge" style={{ background: meta.bg, color: meta.ink }}>
          {meta.icon} {meta.label}
        </span>
      </header>

      <section className="card detail-section" aria-labelledby="detail-items-title">
        <h2 id="detail-items-title">Itens</h2>
        <ul className="detail-items">
          {order.items.map((item, index) => (
            <li key={`${item.productName}-${index}`}>
              <span>{item.quantity}× {item.productName}</span>
              <span className="mono">{formatCentsBRL(item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="detail-total">
          <strong>Total</strong>
          <strong className="mono">{formatCentsBRL(order.totalCents)}</strong>
        </p>
      </section>

      <section className="card detail-section" aria-labelledby="detail-address-title">
        <h2 id="detail-address-title">Endereço de entrega</h2>
        <p>
          {address.street}, {address.number}
          {address.complement && ` — ${address.complement}`}
          <br />
          {address.district}, {address.city} — {address.state}
          <br />
          CEP {maskCep(address.zipCode)}
        </p>
      </section>

      <section className="card detail-section" aria-labelledby="detail-status-title">
        <h2 id="detail-status-title">Acompanhamento</h2>
        <dl className="detail-dates">
          <div><dt>Criado em</dt><dd><time dateTime={order.createdAt}>{formatLocalDateTime(order.createdAt)}</time></dd></div>
          <div><dt>Atualizado em</dt><dd><time dateTime={order.updatedAt}>{formatLocalDateTime(order.updatedAt)}</time></dd></div>
        </dl>
        {mutationError && <p className="detail-error" role="alert">{mutationError}</p>}
        {(next || canCancel) && (
          <div className="detail-actions">
            {confirmingCancel ? (
              <>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirmingCancel(false)}>Voltar</button>
                <button type="button" className="btn btn-primary order-cancel-confirm" disabled={busy} onClick={() => changeStatus("CANCELADO")}>
                  {busy ? "Cancelando…" : "Confirmar cancelamento"}
                </button>
              </>
            ) : (
              <>
                {canCancel && <button type="button" className="btn btn-danger-ghost" disabled={busy} onClick={() => setConfirmingCancel(true)}>Cancelar</button>}
                {next && advanceLabel && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => changeStatus(next)}>{busy ? "Salvando…" : advanceLabel}</button>}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
