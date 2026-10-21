import { LoadMoreFooter } from "./LoadMoreFooter";
import { MobileEmpty } from "./MobileEmpty";
import { MobileTab } from "./MobileTab";
import { OrderCard } from "./OrderCard";
import { OrderListError } from "./OrderListError";
import { OrderListSkeleton } from "./OrderListSkeleton";
import { TABS } from "./orderTabs";
import { STATUS_META } from "./statusMeta";
import { useOrdersByStatus } from "./useOrders";
import { useSelectedStatus } from "./useSelectedStatus";
import "./mobileboard.css";

export function MobileBoard({ notify }: { notify: (msg: string) => void }) {
  const { selected, select } = useSelectedStatus();
  const query = useOrdersByStatus(selected);
  const page = query.data;

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
