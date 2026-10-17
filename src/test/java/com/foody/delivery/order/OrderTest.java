package com.foody.delivery.order;

import com.foody.delivery.shared.exception.ConflictException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OrderTest {

    private static final Address ADDRESS =
            new Address("Rua das Flores", "100", null, "Centro", "São Paulo", "SP", "01001000");

    private static Order placed() {
        return Order.place("user-1", List.of(new OrderItem("Pizza", 4990L, 2)), ADDRESS);
    }

    @Test
    void placeStartsAsRecebidoWithServerComputedTotalAndTimestamps() {
        Order order = Order.place("user-1",
                List.of(new OrderItem("Pizza", 4990L, 2), new OrderItem("Guaraná", 1500L, 1)), ADDRESS);

        assertThat(order.getId()).hasSize(36);
        assertThat(order.getUserId()).isEqualTo("user-1");
        assertThat(order.getStatus()).isEqualTo(OrderStatus.RECEBIDO);
        assertThat(order.getTotalCents()).isEqualTo(11480L);
        assertThat(order.getDeliveryAddress()).isSameAs(ADDRESS);
        assertThat(order.getItems()).hasSize(2);
        assertThat(order.getCreatedAt()).isNotNull().isEqualTo(order.getUpdatedAt());
    }

    @Test
    void placeCopiesTheItemListSoLaterMutationOfTheArgumentIsIgnored() {
        List<OrderItem> items = new ArrayList<>(List.of(new OrderItem("Pizza", 4990L, 1)));
        Order order = Order.place("user-1", items, ADDRESS);

        items.add(new OrderItem("Extra", 100L, 1));

        assertThat(order.getItems()).hasSize(1);
    }

    @Test
    void placeRejectsNullOrEmptyItems() {
        assertThatThrownBy(() -> Order.place("user-1", null, ADDRESS))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Order requires at least one item");
        assertThatThrownBy(() -> Order.place("user-1", List.of(), ADDRESS))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void placeRefusesATotalThatOverflowsLong() {
        List<OrderItem> items = List.of(
                new OrderItem("A", Long.MAX_VALUE, 1), new OrderItem("B", 1L, 1));

        assertThatThrownBy(() -> Order.place("user-1", items, ADDRESS))
                .isInstanceOf(ArithmeticException.class);
    }

    @Test
    void changeStatusAppliesAnAllowedTransitionAndTouchesUpdatedAt() throws InterruptedException {
        Order order = placed();
        Thread.sleep(2);

        order.changeStatus(OrderStatus.EM_PREPARO);

        assertThat(order.getStatus()).isEqualTo(OrderStatus.EM_PREPARO);
        assertThat(order.getUpdatedAt()).isAfter(order.getCreatedAt());
    }

    @Test
    void changeStatusRejectsADisallowedTransitionAndLeavesTheOrderUntouched() {
        Order order = placed();

        assertThatThrownBy(() -> order.changeStatus(OrderStatus.ENTREGUE))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Cannot change status from RECEBIDO to ENTREGUE")
                .satisfies(e -> assertThat(((ConflictException) e).getTitle())
                        .isEqualTo("Invalid status transition"));
        assertThat(order.getStatus()).isEqualTo(OrderStatus.RECEBIDO);
        assertThat(order.getUpdatedAt()).isEqualTo(order.getCreatedAt());
    }

    @Test
    void changeStatusToNullIsAConflictNotAnNpe() {
        Order order = placed();

        assertThatThrownBy(() -> order.changeStatus(null)).isInstanceOf(ConflictException.class);
    }
}
