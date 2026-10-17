package com.foody.delivery.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateOrderRequest(
        @NotEmpty @Size(max = 100) @Valid List<@NotNull OrderItemRequest> items,
        @NotNull @Valid AddressDto deliveryAddress) {
}
