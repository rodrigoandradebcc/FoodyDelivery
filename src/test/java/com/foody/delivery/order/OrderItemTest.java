package com.foody.delivery.order;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OrderItemTest {

    @Test
    void constructorAssignsAUuidAndKeepsTheValues() {
        OrderItem item = new OrderItem("Pizza", 4990L, 2);

        assertThat(item.getId()).hasSize(36);
        assertThat(item.getProductName()).isEqualTo("Pizza");
        assertThat(item.getUnitPriceCents()).isEqualTo(4990L);
        assertThat(item.getQuantity()).isEqualTo(2);
    }

    @Test
    void subtotalIsUnitPriceTimesQuantity() {
        assertThat(new OrderItem("Pizza", 4990L, 3).subtotalCents()).isEqualTo(14970L);
        assertThat(new OrderItem("Brinde", 0L, 5).subtotalCents()).isZero();
    }

    @Test
    void subtotalRefusesToOverflow() {
        OrderItem item = new OrderItem("Pizza", Long.MAX_VALUE, 2);

        assertThatThrownBy(item::subtotalCents).isInstanceOf(ArithmeticException.class);
    }
}
