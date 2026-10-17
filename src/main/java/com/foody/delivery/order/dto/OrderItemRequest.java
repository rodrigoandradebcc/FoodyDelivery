package com.foody.delivery.order.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record OrderItemRequest(
        @NotBlank @Size(max = 150) String productName,
        @NotNull @Min(0) @Max(100_000_000) Long unitPriceCents,
        @NotNull @Min(1) @Max(1000) Integer quantity) {
}
