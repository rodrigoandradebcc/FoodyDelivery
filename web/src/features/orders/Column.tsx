import type { OrderStatus } from "../../api/types";
import { AnimatedOrderCard } from "./AnimatedOrderCard";
import { ColumnEmpty } from "./ColumnEmpty";
import { LoadMoreFooter } from "./LoadMoreFooter";
import { OrderListError } from "./OrderListError";
import { OrderListSkeleton } from "./OrderListSkeleton";
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
          <OrderListSkeleton count={3} />
        </div>
      )}

      {query.isError && !page && (
        <OrderListError onRetry={() => query.refetch()} />
      )}

      {page && page.content.length === 0 && <ColumnEmpty status={status} />}

      {page && page.content.length > 0 && (
        <div className="column-list">
          {page.content.map((order, index) => (
            <AnimatedOrderCard
              key={order.id}
              order={order}
              index={index}
              notify={notify}
            />
          ))}
          <LoadMoreFooter
            hasNextPage={!!query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            isFetchNextPageError={query.isFetchNextPageError}
            onLoadMore={() => query.fetchNextPage()}
          />
        </div>
      )}
    </section>
  );
}
