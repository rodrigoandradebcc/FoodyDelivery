package com.foody.delivery.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreateOrderRequest(
        @NotEmpty @Valid List<@NotNull OrderItemRequest> items,
        @NotNull @Valid AddressDto deliveryAddress) {
}
