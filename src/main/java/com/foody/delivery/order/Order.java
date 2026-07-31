package com.foody.delivery.order;

import com.foody.delivery.shared.exception.ConflictException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrderStatus status;

    @Column(name = "total_cents", nullable = false)
    private long totalCents;

    @Embedded
    private Address deliveryAddress;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "order_id", nullable = false)
    private List<OrderItem> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Order() {
        // JPA
    }

    /**
     * Orders are born RECEBIDO and the total is ALWAYS computed here,
     * on the server, from the items. Never accepted from the client.
     */
    public static Order place(String userId, List<OrderItem> items, Address deliveryAddress) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Order requires at least one item");
        }
        Order order = new Order();
        order.id = UUID.randomUUID().toString();
        order.userId = userId;
        order.status = OrderStatus.RECEBIDO;
        order.items = new ArrayList<>(items);
        order.deliveryAddress = deliveryAddress;
        order.totalCents = items.stream().mapToLong(OrderItem::subtotalCents).sum();
        Instant now = Instant.now();
        order.createdAt = now;
        order.updatedAt = now;
        return order;
    }

    /** Transition rule enforced in the domain; invalid transition -> 409. */
    public void changeStatus(OrderStatus next) {
        if (!status.canTransitionTo(next)) {
            throw new ConflictException("Invalid status transition",
                    "Cannot change status from %s to %s".formatted(status, next));
        }
        this.status = next;
        this.updatedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public long getTotalCents() {
        return totalCents;
    }

    public Address getDeliveryAddress() {
        return deliveryAddress;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
