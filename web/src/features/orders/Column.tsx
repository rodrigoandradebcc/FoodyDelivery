import type { OrderStatus } from "../../api/types";
import { OrderListStates } from "./OrderListStates";
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

      <OrderListStates status={status} notify={notify} query={query} variant="column" />
    </section>
  );
}
