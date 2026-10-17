package com.foody.delivery.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateOrderRequest(
        @NotBlank @Size(max = 120) String customerName,
        @NotEmpty @Size(max = 100) @Valid List<@NotNull OrderItemRequest> items,
        @NotNull @Valid AddressDto deliveryAddress) {
    public CreateOrderRequest {
        if (customerName != null) {
            customerName = customerName.strip();
        }
    }
}
