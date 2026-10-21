import { useSearchParams } from "react-router";
import type { OrderStatus } from "../../api/types";
import MobileTab from "./MobileTab";
import { OrderListStates } from "./OrderListStates";
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
        <OrderListStates status={selected} notify={notify} query={query} variant="mobile" />
      </div>
    </div>
  );
}
