package com.foody.delivery.order;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class OrderStatusTest {

    @ParameterizedTest(name = "{0} -> {1} should be {2}")
    @CsvSource({
            // from,              to,                 allowed
            "RECEBIDO,           RECEBIDO,           false",
            "RECEBIDO,           EM_PREPARO,         true",
            "RECEBIDO,           SAIU_PARA_ENTREGA,  false",
            "RECEBIDO,           ENTREGUE,           false",
            "RECEBIDO,           CANCELADO,          true",
            "EM_PREPARO,         RECEBIDO,           false",
            "EM_PREPARO,         EM_PREPARO,         false",
            "EM_PREPARO,         SAIU_PARA_ENTREGA,  true",
            "EM_PREPARO,         ENTREGUE,           false",
            "EM_PREPARO,         CANCELADO,          true",
            "SAIU_PARA_ENTREGA,  RECEBIDO,           false",
            "SAIU_PARA_ENTREGA,  EM_PREPARO,         false",
            "SAIU_PARA_ENTREGA,  SAIU_PARA_ENTREGA,  false",
            "SAIU_PARA_ENTREGA,  ENTREGUE,           true",
            "SAIU_PARA_ENTREGA,  CANCELADO,          false",
            "ENTREGUE,           RECEBIDO,           false",
            "ENTREGUE,           EM_PREPARO,         false",
            "ENTREGUE,           SAIU_PARA_ENTREGA,  false",
            "ENTREGUE,           ENTREGUE,           false",
            "ENTREGUE,           CANCELADO,          false",
            "CANCELADO,          RECEBIDO,           false",
            "CANCELADO,          EM_PREPARO,         false",
            "CANCELADO,          SAIU_PARA_ENTREGA,  false",
            "CANCELADO,          ENTREGUE,           false",
            "CANCELADO,          CANCELADO,          false"
    })
    void transitionMatrix(OrderStatus from, OrderStatus to, boolean allowed) {
        assertThat(from.canTransitionTo(to)).isEqualTo(allowed);
    }

    /**
     * Pins the null guard in {@code canTransitionTo}. {@code allowedNext} is a {@code Set.of(...)},
     * and JDK immutable sets throw {@code NullPointerException} from {@code contains(null)} —
     * the non-empty ones with "Cannot invoke \"Object.equals(Object)\" because \"o\" is null",
     * the empty {@code Set.of()} of the terminal states ENTREGUE/CANCELADO with a bare NPE.
     * Verified by running it against the unguarded version: all five constants threw. So
     * deleting {@code next != null &&} does not merely change an answer, it turns a null target
     * into an unhandled 500. This case is covered here rather than in the CsvSource matrix
     * because @CsvSource cannot express a null enum argument.
     */
    @ParameterizedTest(name = "{0} -> null should be false, never an NPE")
    @EnumSource(OrderStatus.class)
    void nullTargetIsNeverAllowed(OrderStatus from) {
        assertThatCode(() -> from.canTransitionTo(null)).doesNotThrowAnyException();
        assertThat(from.canTransitionTo(null)).isFalse();
    }
}
