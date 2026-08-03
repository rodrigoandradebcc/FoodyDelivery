package com.foody.delivery.order.dto;

import com.foody.delivery.order.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateStatusRequest(@NotNull OrderStatus status) {
}
