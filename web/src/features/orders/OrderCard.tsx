import { Link } from "react-router";
import type { OrderResponse } from "../../api/types";
import { maskCep } from "../../lib/cep";
import { formatCentsBRL } from "../../lib/money";
import { formatLocalDateTime, formatRelative } from "../../lib/time";
import { StatusActions } from "./StatusActions";

export function OrderCard({
  order,
  notify,
}: {
  order: OrderResponse;
  notify: (msg: string) => void;
}) {
  const addr = order.deliveryAddress;
  const [first, ...rest] = order.items;

  return (
    <article className="order-card card">
      <header className="order-card-top">
        <span className="mono order-id" title={order.id}>
          #{order.id.slice(0, 8)}
        </span>
        <span className="order-times">
          <time className="order-time" dateTime={order.createdAt}>{formatRelative(order.createdAt)}</time>
          <time className="order-time" dateTime={order.createdAt}>{formatLocalDateTime(order.createdAt)}</time>
        </span>
      </header>

      <Link className="order-customer" to={`/orders/${encodeURIComponent(order.id)}`}>
        {order.customerName}
      </Link>

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
        <StatusActions
          order={order}
          compact
          onError={(e) => notify(e.status === 409 ? "Transição inválida — o quadro foi atualizado." : e.message)}
        />
      </footer>
    </article>
  );
}
