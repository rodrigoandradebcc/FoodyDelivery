import type { OrderResponse } from "../../api/types";
import { OrderCard } from "./OrderCard";
import { cardEnterDelayMs } from "./cardEnterDelay";

type Props = {
  order: OrderResponse;
  index: number;
  notify: (msg: string) => void;
};

export function AnimatedOrderCard({ order, index, notify }: Props) {
  return (
    <div
      className="card-enter"
      style={{ animationDelay: `${cardEnterDelayMs(index)}ms` }}
    >
      <OrderCard order={order} notify={notify} />
    </div>
  );
}
