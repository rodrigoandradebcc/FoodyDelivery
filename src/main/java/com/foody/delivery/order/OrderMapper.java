package com.foody.delivery.order;

import com.foody.delivery.order.dto.AddressDto;
import com.foody.delivery.order.dto.OrderItemRequest;
import com.foody.delivery.order.dto.OrderItemResponse;
import com.foody.delivery.order.dto.OrderResponse;

import java.util.List;

public final class OrderMapper {

    private OrderMapper() {
    }

    public static Address toAddress(AddressDto dto) {
        return new Address(dto.street(), dto.number(), dto.complement(), dto.district(),
                dto.city(), dto.state(), dto.zipCode());
    }

    public static List<OrderItem> toItems(List<OrderItemRequest> items) {
        return items.stream()
                .map(item -> new OrderItem(item.productName(), item.unitPriceCents(), item.quantity()))
                .toList();
    }

    public static OrderResponse toResponse(Order order) {
        Address address = order.getDeliveryAddress();
        return new OrderResponse(
                order.getId(),
                order.getStatus().name(),
                order.getTotalCents(),
                order.getItems().stream()
                        .map(item -> new OrderItemResponse(
                                item.getProductName(), item.getUnitPriceCents(), item.getQuantity()))
                        .toList(),
                new AddressDto(address.getStreet(), address.getNumber(), address.getComplement(),
                        address.getDistrict(), address.getCity(), address.getState(), address.getZipCode()),
                order.getCreatedAt(),
                order.getUpdatedAt());
    }
}
