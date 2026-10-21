import { Link } from "react-router";
import type { OrderResponse } from "../../api/types";
import EyeIcon from "../../components/icons/EyeIcon";
import { maskCep } from "../../lib/cep";
import { formatCentsBRL } from "../../lib/money";
import { formatLocalDateTime, formatRelative } from "../../lib/time";
import { extraItemsLabel, statusErrorMessage } from "./orderText";
import { StatusActions } from "./StatusActions";
import "./ordercard.css";

export function OrderCard({
  order,
  notify,
}: {
  order: OrderResponse;
  notify: (msg: string) => void;
}) {
  const addr = order.deliveryAddress;
  const [first, ...rest] = order.items;
  const detailPath = `/orders/${encodeURIComponent(order.id)}`;

  return (
    <article className="card order-card" data-status={order.status}>
      <div className="order-body">
        <header className="order-top">
          <Link className="order-customer" to={detailPath}>
            {order.customerName}
          </Link>
          <span className="mono order-id" title={order.id}>
            #{order.id.slice(0, 8)}
          </span>
        </header>

        <p className="order-summary">
          {first?.quantity}× {first?.productName}
          {rest.length > 0 && (
            <span className="order-more">
              {" "}
              {extraItemsLabel(rest.length)}
            </span>
          )}
        </p>

        <div className="order-meta">
          <p className="order-place">
            {addr.street}, {addr.number} · {addr.district}
          </p>
          <p className="order-times tnum">
            <time dateTime={order.createdAt}>{formatRelative(order.createdAt)}</time>
            {" · "}
            <time dateTime={order.createdAt}>{formatLocalDateTime(order.createdAt)}</time>
          </p>
        </div>

        <details className="order-details">
          <summary>Detalhes</summary>
          <ul className="order-items">
            {order.items.map((item, i) => (
              <li key={`${item.productName}-${i}`}>
                <span>
                  {item.quantity}× {item.productName}
                </span>
                <span className="tnum">
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
      </div>

      <div className="tear" aria-hidden="true" />

      <footer className="order-foot">
        <div className="order-row">
          <strong className="tnum order-total">{formatCentsBRL(order.totalCents)}</strong>
          <StatusActions
            order={order}
            compact
            onError={(e) => notify(statusErrorMessage(e, "quadro"))}
          />
        </div>
        <div className="order-row">
          <span className="status-bar" aria-hidden="true" />
          <Link className="order-eye" to={detailPath} tabIndex={-1} aria-hidden="true">
            <EyeIcon />
          </Link>
        </div>
      </footer>
    </article>
  );
}
