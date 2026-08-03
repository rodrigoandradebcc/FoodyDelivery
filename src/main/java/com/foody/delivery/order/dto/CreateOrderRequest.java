package com.foody.delivery.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * There is deliberately no total field: {@code total_cents} is always computed
 * server-side by {@code Order.place} from the items, so a payload carrying a total
 * simply cannot influence the stored value.
 *
 * <p>{@code @NotEmpty} is what stops an empty {@code items} array. Without it the
 * request would reach {@code Order.place}, which throws {@code IllegalArgumentException} --
 * and {@code ApiExceptionHandler} intentionally does not handle that, so the client
 * would get a 500 instead of a 400. The domain guard stays a last-resort assertion.
 *
 * <p>{@code @Valid} is what makes the per-item constraints on
 * {@link OrderItemRequest} run at all; without it they are silently skipped.
 * {@code List<@NotNull ...>} covers the remaining hole: a JSON {@code [null]} element
 * is not a cascade target, so without it a null element would slip through validation
 * and NPE inside the mapper as a 500.
 */
public record CreateOrderRequest(
        @NotEmpty @Valid List<@NotNull OrderItemRequest> items,
        @NotNull @Valid AddressDto deliveryAddress) {
}
