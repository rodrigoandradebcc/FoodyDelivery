import { Link } from "react-router";
import type { OrderStatus } from "../../api/types";
import EmptyMark from "./EmptyMark";
import { OrderCard } from "./OrderCard";
import { EMPTY_HINT, STATUS_META } from "./statusMeta";
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
      data-status={status}
      aria-label={meta.label}
    >
      <header className="column-header">
        <h2 className="column-title">
          <span className="column-icon">{meta.icon}</span>
          {meta.label}
        </h2>
        <span className="column-count tnum">{page?.totalElements ?? "…"}</span>
      </header>

      {query.isPending && (
        <div className="column-list" aria-hidden="true">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      )}

      {query.isError && !page && (
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
        <div className="column-empty">
          <EmptyMark />
          <p>{EMPTY_HINT[status]}</p>
          {status === "RECEBIDO" && (
            <Link to="/orders/new" className="btn btn-sm btn-ghost">
              Criar pedido
            </Link>
          )}
        </div>
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
          {query.isFetchNextPageError && (
            <p className="column-page-error">Não foi possível carregar mais pedidos.</p>
          )}
          {query.hasNextPage && (
            <button
              type="button"
              className="btn btn-sm btn-ghost column-load-more"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
