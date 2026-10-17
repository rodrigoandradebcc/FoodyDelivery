package com.foody.delivery.order;

import com.foody.delivery.AbstractIntegrationTest;
import com.foody.delivery.user.User;
import com.foody.delivery.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves that: Flyway migrations run on a fresh SQLite file, Hibernate
 * ddl-auto=validate accepts the schema, and entities round-trip
 * (UUID text ids, Instant as ISO-8601 text, money as long cents).
 */
class PersistenceIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void migrationsRunAndEntitiesRoundTrip() {
        User user = User.register("Rodrigo",
                "rodrigo-" + UUID.randomUUID() + "@example.com",
                "$2a$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcdefghi");
        userRepository.save(user);

        Address address = new Address("Rua das Flores", "100", null, "Centro",
                "São Paulo", "SP", "01001000");
        Order order = Order.place(user.getId(),
                List.of(new OrderItem("Pizza Calabresa", 4990L, 2)), address);
        orderRepository.save(order);

        Order reloaded = orderRepository.findById(order.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(OrderStatus.RECEBIDO);
        assertThat(reloaded.getTotalCents()).isEqualTo(9980L);
        assertThat(reloaded.getItems()).hasSize(1);
        assertThat(reloaded.getItems().get(0).getUnitPriceCents()).isEqualTo(4990L);
        assertThat(reloaded.getUserId()).isEqualTo(user.getId());
        assertThat(reloaded.getDeliveryAddress().getCity()).isEqualTo("São Paulo");
        assertThat(reloaded.getCreatedAt()).isEqualTo(order.getCreatedAt());
        assertThat(reloaded.getId()).hasSize(36);
    }

    @Test
    void staleUpdateIsRejectedAndTheFirstWriteWins() {
        User user = userRepository.save(User.register("Rodrigo",
                "rodrigo-" + UUID.randomUUID() + "@example.com",
                "$2a$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcdefghi"));
        Order order = Order.place(user.getId(), List.of(new OrderItem("Pizza Calabresa", 4990L, 2)),
                new Address("Rua das Flores", "100", null, "Centro", "São Paulo", "SP", "01001000"));
        orderRepository.save(order);

        Order first = orderRepository.findById(order.getId()).orElseThrow();
        Order second = orderRepository.findById(order.getId()).orElseThrow();
        first.changeStatus(OrderStatus.EM_PREPARO);
        orderRepository.save(first);
        second.changeStatus(OrderStatus.CANCELADO);

        assertThatThrownBy(() -> orderRepository.save(second))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
        Order reloaded = orderRepository.findById(order.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(OrderStatus.EM_PREPARO);
        assertThat(reloaded.getVersion()).isGreaterThan(first.getVersion());
    }

    @Test
    void concurrentStatusUpdatesLetOneWinAndRejectTheOtherAsAConcurrencyFailure() throws Exception {
        User user = userRepository.save(User.register("Rodrigo",
                "rodrigo-" + UUID.randomUUID() + "@example.com",
                "$2a$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcdefghi"));
        Order order = Order.place(user.getId(), List.of(new OrderItem("Pizza Calabresa", 4990L, 2)),
                new Address("Rua das Flores", "100", null, "Centro", "São Paulo", "SP", "01001000"));
        orderRepository.save(order);
        long versionBefore = orderRepository.findById(order.getId()).orElseThrow().getVersion();

        CyclicBarrier bothRead = new CyclicBarrier(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<?>> outcomes = new ArrayList<>();
            for (OrderStatus next : List.of(OrderStatus.EM_PREPARO, OrderStatus.CANCELADO)) {
                outcomes.add(executor.submit(() -> transaction.executeWithoutResult(status -> {
                    Order loaded = orderRepository.findById(order.getId()).orElseThrow();
                    await(bothRead);
                    loaded.changeStatus(next);
                    orderRepository.saveAndFlush(loaded);
                })));
            }

            List<Throwable> failures = new ArrayList<>();
            for (Future<?> outcome : outcomes) {
                try {
                    outcome.get(30, TimeUnit.SECONDS);
                } catch (ExecutionException e) {
                    failures.add(e.getCause());
                }
            }

            assertThat(failures).hasSize(1);
            assertThat(failures.get(0)).isInstanceOfAny(
                    ObjectOptimisticLockingFailureException.class, CannotAcquireLockException.class);
        } finally {
            executor.shutdownNow();
        }
        Order reloaded = orderRepository.findById(order.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isIn(OrderStatus.EM_PREPARO, OrderStatus.CANCELADO);
        assertThat(reloaded.getVersion()).isEqualTo(versionBefore + 1);
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(30, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
