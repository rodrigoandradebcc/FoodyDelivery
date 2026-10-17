package com.foody.delivery.order;

import com.foody.delivery.TestDatabase;
import com.foody.delivery.user.User;
import com.foody.delivery.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class OrderRepositoryTest {

    static final String JDBC_URL = TestDatabase.newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private UserRepository userRepository;

    private static Address address() {
        return new Address("Rua das Flores", "100", null, "Centro", "São Paulo", "SP", "01001000");
    }

    private String newUserId() {
        return userRepository.save(User.register("U", UUID.randomUUID() + "@example.com", "$2a$10$hash")).getId();
    }

    private Order saved(String userId, OrderStatus status) {
        Order order = Order.place(userId, List.of(new OrderItem("Pizza", 4990L, 1)), address());
        if (status != OrderStatus.RECEBIDO) {
            order.changeStatus(status);
        }
        return orderRepository.save(order);
    }

    @Test
    void findByStatusReturnsOnlyMatchingOrders() {
        String userId = newUserId();
        Order received = saved(userId, OrderStatus.RECEBIDO);
        Order preparing = saved(userId, OrderStatus.EM_PREPARO);
        Order cancelled = saved(userId, OrderStatus.CANCELADO);

        Page<Order> page = orderRepository.findByStatus(OrderStatus.EM_PREPARO, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(Order::getId)
                .contains(preparing.getId())
                .doesNotContain(received.getId(), cancelled.getId());
    }

    @Test
    void findByStatusPaginatesAndCountsTheWholeFilteredSet() {
        String userId = newUserId();
        saved(userId, OrderStatus.CANCELADO);
        saved(userId, OrderStatus.CANCELADO);
        saved(userId, OrderStatus.CANCELADO);

        Page<Order> firstPage = orderRepository.findByStatus(OrderStatus.CANCELADO,
                PageRequest.of(0, 2, Sort.by("id")));
        Page<Order> secondPage = orderRepository.findByStatus(OrderStatus.CANCELADO,
                PageRequest.of(1, 2, Sort.by("id")));

        assertThat(firstPage.getContent()).hasSize(2);
        assertThat(firstPage.getTotalElements()).isGreaterThanOrEqualTo(3);
        assertThat(firstPage.getContent()).extracting(Order::getId).isSorted();
        assertThat(secondPage.getContent()).extracting(Order::getId)
                .doesNotContainAnyElementsOf(firstPage.getContent().stream().map(Order::getId).toList());
    }

    @Test
    void savedOrderReloadsWithItemsAddressAndTimestamps() {
        Order order = saved(newUserId(), OrderStatus.RECEBIDO);

        Order reloaded = orderRepository.findById(order.getId()).orElseThrow();

        assertThat(reloaded.getItems()).singleElement()
                .satisfies(item -> assertThat(item.getProductName()).isEqualTo("Pizza"));
        assertThat(reloaded.getDeliveryAddress().getZipCode()).isEqualTo("01001000");
        assertThat(reloaded.getCreatedAt()).isEqualTo(order.getCreatedAt());
        assertThat(reloaded.getUpdatedAt()).isEqualTo(order.getUpdatedAt());
    }
}
