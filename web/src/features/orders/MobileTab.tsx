import type { OrderStatus } from "../../api/types";
import { STATUS_META } from "./statusMeta";
import { useOrdersByStatus } from "./useOrders";

export default function MobileTab({
  status,
  active,
  onSelect,
}: {
  status: OrderStatus;
  active: boolean;
  onSelect: (s: OrderStatus) => void;
}) {
  const meta = STATUS_META[status];
  const query = useOrdersByStatus(status);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-status={status}
      className={`mtab${active ? " mtab-active" : ""}${status === "CANCELADO" ? " mtab-exit" : ""}`}
      onClick={() => onSelect(status)}
    >
      {meta.icon} {meta.label}
      <span className="mtab-count tnum">{query.data?.totalElements ?? "…"}</span>
    </button>
  );
}
