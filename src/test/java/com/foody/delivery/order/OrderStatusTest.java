package com.foody.delivery.order;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

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
}
