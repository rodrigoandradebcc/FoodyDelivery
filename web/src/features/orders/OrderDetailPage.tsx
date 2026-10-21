import { Link, useParams } from "react-router";
import PageHeader from "../../components/PageHeader";
import { maskCep } from "../../lib/cep";
import { formatCentsBRL } from "../../lib/money";
import { formatLocalDateTime } from "../../lib/time";
import { STATUS_META } from "./statusMeta";
import { StatusActions } from "./StatusActions";
import { useOrderDetail } from "./useOrderDetail";
import { useStatusMutationError } from "./useStatusMutationError";
import "./orderdetail.css";

export default function OrderDetailPage() {
  const { id } = useParams();
  const { query, order, notFound, loadErrorMessage } = useOrderDetail(id);
  const { mutationError, onChangeStart, onError } = useStatusMutationError();

  if (query.isPending) {
    return (
      <div className="detail-state">
        <PageHeader title="Pedido" />
        <p className="visually-hidden" role="status">
          Carregando pedido…
        </p>
      </div>
    );
  }

  if (query.isError || !order) {
    return (
      <div className="detail-state">
        <PageHeader
          title={notFound ? "Pedido não encontrado" : "Não foi possível carregar o pedido"}
          eyebrow={<Link className="back-link" to="/">Voltar aos pedidos</Link>}
        />
        {!notFound && (
          <div className="card detail-state-content">
            <p>{loadErrorMessage}</p>
            <button type="button" className="btn btn-ghost" onClick={() => query.refetch()}>
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    );
  }

  const meta = STATUS_META[order.status];
  const address = order.deliveryAddress;

  return (
    <div className="order-detail">
      <PageHeader
        title={order.customerName}
        eyebrow={
          <>
            <Link className="back-link" to="/">Voltar aos pedidos</Link>
            <span className="mono detail-id">Pedido #{order.id}</span>
          </>
        }
        aside={<span className="status-pill" data-status={order.status}>{meta.icon} {meta.label}</span>}
      />

      <div className="detail-grid">
        <div className="detail-main">
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
            <div className="tear" aria-hidden="true" />
            <p className="detail-total">
              <strong>Total</strong>
              <strong className="mono tnum">{formatCentsBRL(order.totalCents)}</strong>
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
        </div>

        <section className="card detail-section detail-tracking" aria-labelledby="detail-status-title">
          <h2 id="detail-status-title">Acompanhamento</h2>
          <dl className="detail-dates">
            <div><dt>Criado em</dt><dd><time dateTime={order.createdAt}>{formatLocalDateTime(order.createdAt)}</time></dd></div>
            <div><dt>Atualizado em</dt><dd><time dateTime={order.updatedAt}>{formatLocalDateTime(order.updatedAt)}</time></dd></div>
          </dl>
          {mutationError && <p className="detail-error" role="alert">{mutationError}</p>}
          <StatusActions
            order={order}
            onChangeStart={onChangeStart}
            onError={onError}
          />
        </section>
      </div>
    </div>
  );
}
