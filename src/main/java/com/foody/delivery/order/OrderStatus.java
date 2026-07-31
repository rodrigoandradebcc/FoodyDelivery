package com.foody.delivery.order;

import java.util.Set;

/**
 * Order state machine. The transition rule lives HERE, not in controllers.
 * Documented decision: after SAIU_PARA_ENTREGA an order can no longer be cancelled.
 */
public enum OrderStatus {

    RECEBIDO,
    EM_PREPARO,
    SAIU_PARA_ENTREGA,
    ENTREGUE,
    CANCELADO;

    private Set<OrderStatus> allowedNext = Set.of();

    static {
        RECEBIDO.allowedNext = Set.of(EM_PREPARO, CANCELADO);
        EM_PREPARO.allowedNext = Set.of(SAIU_PARA_ENTREGA, CANCELADO);
        SAIU_PARA_ENTREGA.allowedNext = Set.of(ENTREGUE);
        // ENTREGUE and CANCELADO are terminal: empty set.
    }

    public boolean canTransitionTo(OrderStatus next) {
        return allowedNext.contains(next);
    }
}
