package com.foody.delivery.order.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Nothing else in the stack enforces {@code quantity >= 1} or
 * {@code unit_price_cents >= 0}: there is no CHECK constraint in the migration and
 * {@link com.foody.delivery.order.OrderItem}'s constructor takes whatever it is given.
 * These annotations are the enforcement point, and they are deliberately here on the
 * DTO so a bad value fails as a {@code MethodArgumentNotValidException} -> 400 with the
 * {@code errors} extension rather than as a persisted negative-price order.
 *
 * <p>The boxed types are load-bearing: with {@code long}/{@code int} a missing JSON
 * property would silently default to 0 instead of failing {@code @NotNull}.
 */
public record OrderItemRequest(
        @NotBlank @Size(max = 150) String productName,
        @NotNull @Min(0) Long unitPriceCents,
        @NotNull @Min(1) Integer quantity) {
}
