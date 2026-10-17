import { useEffect, useRef, useState } from "react";
import type { ApiError } from "../../api/http";
import type { OrderResponse, OrderStatus } from "../../api/types";
import { ADVANCE_LABEL, CAN_CANCEL, NEXT_STATUS } from "./statusMeta";
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
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const backButton = useRef<HTMLButtonElement>(null);
  const mutation = useStatusMutation(onError);
  const next = NEXT_STATUS[order.status];
  const advanceLabel = ADVANCE_LABEL[order.status];
  const canCancel = CAN_CANCEL[order.status];
  const busy = mutation.isPending;
  const size = compact ? " btn-sm" : "";

  useEffect(() => {
    if (confirmingCancel) backButton.current?.focus();
  }, [confirmingCancel]);

  if (!next && !canCancel) return null;

  function changeStatus(status: OrderStatus) {
    onChangeStart?.();
    mutation.mutate(
      { id: order.id, status },
      { onSettled: () => setConfirmingCancel(false) },
    );
  }

  return (
    <div className={compact ? "order-actions" : "detail-actions"}>
      {confirmingCancel ? (
        <>
          <button
            ref={backButton}
            type="button"
            className={`btn${size} btn-ghost`}
            aria-label={`Voltar para ações do pedido de ${order.customerName}`}
            disabled={busy}
            onClick={() => setConfirmingCancel(false)}
          >
            Voltar
          </button>
          <button
            type="button"
            className={`btn${size} btn-primary order-cancel-confirm`}
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
              className={`btn${size} btn-danger-ghost`}
              aria-label={`Cancelar pedido de ${order.customerName}`}
              disabled={busy}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancelar
            </button>
          )}
          {next && advanceLabel && (
            <button
              type="button"
              className={`btn${size} btn-primary`}
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
