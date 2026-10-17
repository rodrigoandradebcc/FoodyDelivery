package com.foody.delivery.order;

import java.util.Set;

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
        SAIU_PARA_ENTREGA.allowedNext = Set.of(ENTREGUE, CANCELADO);
    }

    public boolean canTransitionTo(OrderStatus next) {
        return next != null && allowedNext.contains(next);
    }
}
