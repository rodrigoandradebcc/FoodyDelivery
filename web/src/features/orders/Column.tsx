import type { OrderStatus } from "../../api/types";
import { OrderCard } from "./OrderCard";
import { STATUS_META } from "./statusMeta";
import { useOrdersByStatus } from "./useOrders";

export function Column({
  status,
  notify,
}: {
  status: OrderStatus;
  notify: (msg: string) => void;
}) {
  const meta = STATUS_META[status];
  const query = useOrdersByStatus(status);
  const page = query.data;

  return (
    <section
      className="board-column"
      style={{ borderTopColor: meta.ink }}
      aria-label={meta.label}
    >
      <header className="column-header">
        <span className="badge" style={{ background: meta.bg, color: meta.ink }}>
          {meta.icon} {meta.label}
        </span>
        <span className="column-count mono">{page?.totalElements ?? "…"}</span>
      </header>

      {query.isPending && (
        <div className="column-list" aria-hidden="true">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      )}

      {query.isError && (
        <div className="column-empty">
          <p>Não foi possível carregar.</p>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => query.refetch()}
          >
            Tentar de novo
          </button>
        </div>
      )}

      {page && page.content.length === 0 && (
        <p className="column-empty">Nenhum pedido aqui.</p>
      )}

      {page && page.content.length > 0 && (
        <div className="column-list">
          {page.content.map((order, i) => (
            <div
              key={order.id}
              className="card-enter"
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
            >
              <OrderCard order={order} notify={notify} />
            </div>
          ))}
          {page.totalElements > page.content.length && (
            <p className="column-truncated">
              +{page.totalElements - page.content.length} não exibidos
            </p>
          )}
        </div>
      )}
    </section>
  );
}
