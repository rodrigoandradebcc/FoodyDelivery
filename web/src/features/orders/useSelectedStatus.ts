import { useSearchParams } from "react-router";
import type { OrderStatus } from "../../api/types";
import { isStatus } from "./orderTabs";

export function useSelectedStatus() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("status");
  const selected: OrderStatus = isStatus(param) ? param : "RECEBIDO";

  function select(status: OrderStatus) {
    setSearchParams({ status }, { replace: true });
  }

  return { selected, select };
}
