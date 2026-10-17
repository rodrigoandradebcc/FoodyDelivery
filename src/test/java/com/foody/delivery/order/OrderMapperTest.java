package com.foody.delivery.order;

import com.foody.delivery.order.dto.AddressDto;
import com.foody.delivery.order.dto.OrderItemRequest;
import com.foody.delivery.order.dto.OrderResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OrderMapperTest {

    private static final AddressDto ADDRESS_DTO =
            new AddressDto("Rua das Flores", "100", "Apto 42", "Centro", "São Paulo", "SP", "01001000");

    @Test
    void toAddressMapsEveryComponentInOrder() {
        Address address = OrderMapper.toAddress(ADDRESS_DTO);

        assertThat(address.getStreet()).isEqualTo("Rua das Flores");
        assertThat(address.getNumber()).isEqualTo("100");
        assertThat(address.getComplement()).isEqualTo("Apto 42");
        assertThat(address.getDistrict()).isEqualTo("Centro");
        assertThat(address.getCity()).isEqualTo("São Paulo");
        assertThat(address.getState()).isEqualTo("SP");
        assertThat(address.getZipCode()).isEqualTo("01001000");
    }

    @Test
    void toAddressKeepsNullComplement() {
        Address address = OrderMapper.toAddress(
                new AddressDto("Rua", "1", null, "Centro", "São Paulo", "SP", "01001000"));

        assertThat(address.getComplement()).isNull();
    }

    @Test
    void toItemsMapsEveryItemWithAFreshId() {
        List<OrderItem> items = OrderMapper.toItems(List.of(
                new OrderItemRequest("Pizza Calabresa", 4990L, 2),
                new OrderItemRequest("Guaraná 2L", 1500L, 1)));

        assertThat(items).hasSize(2);
        assertThat(items.get(0).getProductName()).isEqualTo("Pizza Calabresa");
        assertThat(items.get(0).getUnitPriceCents()).isEqualTo(4990L);
        assertThat(items.get(0).getQuantity()).isEqualTo(2);
        assertThat(items.get(1).getProductName()).isEqualTo("Guaraná 2L");
        assertThat(items.get(0).getId()).hasSize(36).isNotEqualTo(items.get(1).getId());
    }

    @Test
    void toItemsOfEmptyListIsEmpty() {
        assertThat(OrderMapper.toItems(List.of())).isEmpty();
    }

    @Test
    void toResponseCopiesIdStatusTotalItemsAddressAndTimestamps() {
        Order order = Order.place("user-1",
                List.of(new OrderItem("Pizza Calabresa", 4990L, 2), new OrderItem("Guaraná 2L", 1500L, 1)),
                OrderMapper.toAddress(ADDRESS_DTO));

        OrderResponse response = OrderMapper.toResponse(order);

        assertThat(response.id()).isEqualTo(order.getId());
        assertThat(response.status()).isEqualTo("RECEBIDO");
        assertThat(response.totalCents()).isEqualTo(11480L);
        assertThat(response.items()).hasSize(2);
        assertThat(response.items().get(1).productName()).isEqualTo("Guaraná 2L");
        assertThat(response.items().get(1).unitPriceCents()).isEqualTo(1500L);
        assertThat(response.items().get(1).quantity()).isEqualTo(1);
        assertThat(response.deliveryAddress()).isEqualTo(ADDRESS_DTO);
        assertThat(response.createdAt()).isEqualTo(order.getCreatedAt());
        assertThat(response.updatedAt()).isEqualTo(order.getUpdatedAt());
    }
}
