import { Link } from "react-router";
import type { OrderStatus } from "../../api/types";
import EmptyMark from "./EmptyMark";
import { OrderCard } from "./OrderCard";
import { EMPTY_HINT } from "./statusMeta";
import type { useOrdersByStatus } from "./useOrders";

type Props = {
  status: OrderStatus;
  notify: (msg: string) => void;
  query: ReturnType<typeof useOrdersByStatus>;
  variant: "column" | "mobile";
};

export function OrderListStates({ status, notify, query, variant }: Props) {
  const page = query.data;
  const pageError = query.isFetchNextPageError && (
    <p className="column-page-error">Não foi possível carregar mais pedidos.</p>
  );
  const loadMore = query.hasNextPage && (
    <button
      type="button"
      className="btn btn-sm btn-ghost column-load-more"
      disabled={query.isFetchingNextPage}
      onClick={() => query.fetchNextPage()}
    >
      {query.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
    </button>
  );

  return (
    <>
      {query.isPending && (variant === "column" ? (
        <div className="column-list" aria-hidden="true">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : (
        <>
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </>
      ))}

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

      {page && page.content.length === 0 && (variant === "column" ? (
        <div className="column-empty">
          <EmptyMark />
          <p>{EMPTY_HINT[status]}</p>
          {status === "RECEBIDO" && (
            <Link to="/orders/new" className="btn btn-sm btn-ghost">
              Criar pedido
            </Link>
          )}
        </div>
      ) : (
        <p className="column-empty">{EMPTY_HINT[status]}</p>
      ))}

      {variant === "column" ? (
        page && page.content.length > 0 && (
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
            {pageError}
            {loadMore}
          </div>
        )
      ) : (
        <>
          {page?.content.map((order) => (
            <OrderCard key={order.id} order={order} notify={notify} />
          ))}
          {pageError}
          {loadMore}
        </>
      )}
    </>
  );
}
