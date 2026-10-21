import { useSearchParams } from "react-router";
import type { OrderStatus } from "../../api/types";
import { LoadMoreFooter } from "./LoadMoreFooter";
import { MobileEmpty } from "./MobileEmpty";
import MobileTab from "./MobileTab";
import { OrderCard } from "./OrderCard";
import { OrderListError } from "./OrderListError";
import { OrderListSkeleton } from "./OrderListSkeleton";
import { PIPELINE, STATUS_META } from "./statusMeta";
import { useOrdersByStatus } from "./useOrders";
import "./mobileboard.css";

const TABS: readonly OrderStatus[] = [...PIPELINE, "CANCELADO"];

function isStatus(value: string | null): value is OrderStatus {
  return value !== null && (TABS as readonly string[]).includes(value);
}

export function MobileBoard({ notify }: { notify: (msg: string) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("status");
  const selected: OrderStatus = isStatus(param) ? param : "RECEBIDO";
  const query = useOrdersByStatus(selected);
  const page = query.data;

  function select(status: OrderStatus) {
    setSearchParams({ status }, { replace: true });
  }

  return (
    <div className="mboard">
      <div className="mtabs" role="tablist" aria-label="Status do pedido">
        {TABS.map((status) => (
          <MobileTab key={status} status={status} active={selected === status} onSelect={select} />
        ))}
      </div>

      <div
        className="mboard-list"
        role="tabpanel"
        aria-label={STATUS_META[selected].label}
      >
        {query.isPending && <OrderListSkeleton count={2} />}

        {query.isError && !page && (
          <OrderListError onRetry={() => query.refetch()} />
        )}

        {page && page.content.length === 0 && <MobileEmpty status={selected} />}

        {page?.content.map((order) => (
          <OrderCard key={order.id} order={order} notify={notify} />
        ))}
        <LoadMoreFooter
          hasNextPage={!!query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          isFetchNextPageError={query.isFetchNextPageError}
          onLoadMore={() => query.fetchNextPage()}
        />
      </div>
    </div>
  );
}
