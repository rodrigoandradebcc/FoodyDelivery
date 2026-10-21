import { Link } from "react-router";
import type { OrderStatus } from "../../api/types";
import EmptyMark from "./EmptyMark";
import { EMPTY_HINT } from "./statusMeta";

export function ColumnEmpty({ status }: { status: OrderStatus }) {
  return (
    <div className="column-empty">
      <EmptyMark />
      <p>{EMPTY_HINT[status]}</p>
      {status === "RECEBIDO" && (
        <Link to="/orders/new" className="btn btn-sm btn-ghost">
          Criar pedido
        </Link>
      )}
    </div>
  );
}
