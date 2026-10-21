import type { OrderStatus } from "../../api/types";
import { EMPTY_HINT } from "./statusMeta";

export function MobileEmpty({ status }: { status: OrderStatus }) {
  return <p className="column-empty">{EMPTY_HINT[status]}</p>;
}
