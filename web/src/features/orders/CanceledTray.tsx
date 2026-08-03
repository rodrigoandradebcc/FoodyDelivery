import { OrderCard } from "./OrderCard";
import { STATUS_META } from "./statusMeta";
import { useOrdersByStatus } from "./useOrders";

export function CanceledTray({ notify }: { notify: (msg: string) => void }) {
  const meta = STATUS_META.CANCELADO;
  const query = useOrdersByStatus("CANCELADO");
  const page = query.data;

  return (
    <details className="canceled-tray">
      <summary>
        <span className="badge" style={{ background: meta.bg, color: meta.ink }}>
          {meta.icon} Cancelados
        </span>
        <span className="column-count mono">{page?.totalElements ?? "…"}</span>
      </summary>
      {page && page.content.length === 0 && (
        <p className="column-empty">Nenhum pedido cancelado.</p>
      )}
      {page && page.content.length > 0 && (
        <div className="tray-list">
          {page.content.map((order) => (
            <div key={order.id} className="tray-card">
              <OrderCard order={order} notify={notify} />
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
