package com.foody.delivery.order.dto;

import java.time.Instant;
import java.util.List;

public record OrderResponse(
        String id,
        String status,
        long totalCents,
        List<OrderItemResponse> items,
        AddressDto deliveryAddress,
        Instant createdAt,
        Instant updatedAt) {
}
