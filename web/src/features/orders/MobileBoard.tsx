import { useSearchParams } from "react-router";
import type { OrderStatus } from "../../api/types";
import { OrderCard } from "./OrderCard";
import { EMPTY_HINT, PIPELINE, STATUS_META } from "./statusMeta";
import { useOrdersByStatus } from "./useOrders";

const TABS: readonly OrderStatus[] = [...PIPELINE, "CANCELADO"];

function isStatus(value: string | null): value is OrderStatus {
  return value !== null && (TABS as readonly string[]).includes(value);
}

function Tab({
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
      className={`mtab${active ? " mtab-active" : ""}${status === "CANCELADO" ? " mtab-exit" : ""}`}
      style={active ? { borderBottomColor: meta.ink, color: meta.ink } : undefined}
      onClick={() => onSelect(status)}
    >
      {meta.icon} {meta.label}
      <span className="mtab-count mono">{query.data?.totalElements ?? "…"}</span>
    </button>
  );
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
          <Tab key={status} status={status} active={selected === status} onSelect={select} />
        ))}
      </div>

      <div
        className="mboard-list"
        role="tabpanel"
        aria-label={STATUS_META[selected].label}
      >
        {query.isPending && (
          <>
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </>
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
          <p className="column-empty">{EMPTY_HINT[selected]}</p>
        )}
        {page?.content.map((order) => (
          <OrderCard key={order.id} order={order} notify={notify} />
        ))}
        {page && page.totalElements > page.content.length && (
          <p className="column-truncated">
            +{page.totalElements - page.content.length} não exibidos
          </p>
        )}
      </div>
    </div>
  );
}
