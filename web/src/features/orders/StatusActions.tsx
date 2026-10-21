import type { ApiError } from "../../api/http";
import type { OrderResponse, OrderStatus } from "../../api/types";
import { ADVANCE_LABEL, CAN_CANCEL, NEXT_STATUS } from "./statusMeta";
import { useCancelConfirmation } from "./useCancelConfirmation";
import { useStatusMutation } from "./useOrders";

export function StatusActions({
  order,
  onError,
  onChangeStart,
  compact = false,
}: {
  order: OrderResponse;
  onError: (error: ApiError) => void;
  onChangeStart?: () => void;
  compact?: boolean;
}) {
  const { confirming, backButton, askConfirmation, dismiss } = useCancelConfirmation();
  const mutation = useStatusMutation(onError);
  const next = NEXT_STATUS[order.status];
  const advanceLabel = ADVANCE_LABEL[order.status];
  const canCancel = CAN_CANCEL[order.status];
  const busy = mutation.isPending;
  const size = compact ? " btn-sm" : "";

  if (!next && !canCancel) return null;

  function changeStatus(status: OrderStatus) {
    onChangeStart?.();
    mutation.mutate(
      { id: order.id, status },
      { onSettled: () => dismiss() },
    );
  }

  return (
    <div className={compact ? "order-actions" : "detail-actions"}>
      {confirming ? (
        <>
          <button
            ref={backButton}
            type="button"
            className={`btn${size} btn-ghost btn-pill`}
            aria-label={`Voltar para ações do pedido de ${order.customerName}`}
            disabled={busy}
            onClick={() => dismiss()}
          >
            Voltar
          </button>
          <button
            type="button"
            className={`btn${size} btn-danger btn-pill`}
            aria-label={`Confirmar cancelamento do pedido de ${order.customerName}`}
            disabled={busy}
            onClick={() => changeStatus("CANCELADO")}
          >
            {busy ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
        </>
      ) : (
        <>
          {canCancel && (
            <button
              type="button"
              className={`btn${size} btn-danger-ghost btn-pill`}
              aria-label={`Cancelar pedido de ${order.customerName}`}
              disabled={busy}
              onClick={() => askConfirmation()}
            >
              Cancelar
            </button>
          )}
          {next && advanceLabel && (
            <button
              type="button"
              className={`btn${size} btn-primary btn-pill`}
              aria-label={`${advanceLabel} para pedido de ${order.customerName}`}
              disabled={busy}
              onClick={() => changeStatus(next)}
            >
              {busy ? "Salvando…" : advanceLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
}
