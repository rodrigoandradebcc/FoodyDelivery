package com.foody.delivery.order.dto;

public record OrderItemResponse(String productName, long unitPriceCents, int quantity) {
}
