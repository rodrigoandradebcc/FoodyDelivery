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

    /**
     * The null guard is load-bearing, not defensive noise: {@code allowedNext} is built with
     * {@code Set.of(...)}, and JDK immutable sets throw {@code NullPointerException} on
     * {@code contains(null)} — including the empty {@code Set.of()} of the terminal states.
     * Without the guard a null argument is an unhandled NPE and an HTTP 500 with no
     * ProblemDetail, not a {@code false}. {@code @NotNull} on {@code UpdateStatusRequest.status}
     * keeps that argument from ever arriving through the API, but this method is public, so the
     * guard is what protects any future caller (bulk transition, admin tool) as well.
     */
    public boolean canTransitionTo(OrderStatus next) {
        return next != null && allowedNext.contains(next);
    }
}
