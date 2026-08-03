package com.foody.delivery.order;

import com.foody.delivery.order.dto.AddressDto;
import com.foody.delivery.order.dto.CreateOrderRequest;
import com.foody.delivery.order.dto.OrderItemRequest;
import com.foody.delivery.order.dto.OrderResponse;
import com.foody.delivery.order.dto.PageResponse;
import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.shared.exception.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private OrderService orderService;

    private static AddressDto anyAddress() {
        return new AddressDto("Rua das Flores", "100", null, "Centro",
                "São Paulo", "SP", "01001000");
    }

    private static Address anyDomainAddress() {
        return new Address("Rua das Flores", "100", null, "Centro",
                "São Paulo", "SP", "01001000");
    }

    private static CreateOrderRequest requestWithTwoItems() {
        return new CreateOrderRequest(
                List.of(new OrderItemRequest("Pizza Calabresa", 4990L, 2),
                        new OrderItemRequest("Guaraná 2L", 1500L, 1)),
                anyAddress());
    }

    @Test
    void createComputesTotalOnServerFromItems() {
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.create("user-1", requestWithTwoItems());

        assertThat(response.totalCents()).isEqualTo(4990L * 2 + 1500L);
    }

    @Test
    void createdOrderStartsAsRecebido() {
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.create("user-1", requestWithTwoItems());

        assertThat(response.status()).isEqualTo("RECEBIDO");
    }

    /**
     * The strongest guarantee that a client cannot influence the stored total is
     * structural: there is no field to send it in. If someone ever adds one to the
     * request record, this fails and forces the decision to be made again on purpose.
     */
    @Test
    void createOrderRequestHasNoClientSuppliedTotalField() {
        List<String> components = Arrays.stream(CreateOrderRequest.class.getRecordComponents())
                .map(RecordComponent::getName)
                .toList();

        assertThat(components).containsExactly("items", "deliveryAddress");
    }

    @Test
    void createPersistsTheOrderItOwns() {
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        ArgumentCaptor<Order> saved = ArgumentCaptor.forClass(Order.class);

        OrderResponse response = orderService.create("user-1", requestWithTwoItems());

        verify(orderRepository).save(saved.capture());
        assertThat(saved.getValue().getId()).isEqualTo(response.id());
        assertThat(saved.getValue().getUserId()).isEqualTo("user-1");
        assertThat(saved.getValue().getItems()).hasSize(2);
    }

    @Test
    void validTransitionUpdatesStatus() {
        Order order = Order.place("user-1",
                List.of(new OrderItem("Pizza", 4990L, 1)), anyDomainAddress());
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.updateStatus(order.getId(), OrderStatus.EM_PREPARO);

        assertThat(response.status()).isEqualTo("EM_PREPARO");
    }

    @Test
    void invalidTransitionThrowsConflictAndDoesNotSave() {
        Order order = Order.place("user-1",
                List.of(new OrderItem("Pizza", 4990L, 1)), anyDomainAddress());
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.updateStatus(order.getId(), OrderStatus.ENTREGUE))
                .isInstanceOf(ConflictException.class);
        verify(orderRepository, never()).save(any());
    }

    @Test
    void updateStatusOnUnknownOrderThrowsNotFound() {
        when(orderRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.updateStatus("missing", OrderStatus.EM_PREPARO))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void getByIdOnUnknownOrderThrowsNotFound() {
        when(orderRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.getById("missing"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void getByIdReturnsTheMappedOrder() {
        Order order = Order.place("user-1",
                List.of(new OrderItem("Pizza", 4990L, 3)), anyDomainAddress());
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        OrderResponse response = orderService.getById(order.getId());

        assertThat(response.id()).isEqualTo(order.getId());
        assertThat(response.totalCents()).isEqualTo(4990L * 3);
        assertThat(response.items()).singleElement()
                .satisfies(item -> assertThat(item.productName()).isEqualTo("Pizza"));
        assertThat(response.deliveryAddress().city()).isEqualTo("São Paulo");
    }

    @Test
    void listWithoutStatusFiltersNothingAndCopiesPageMetadata() {
        Order order = Order.place("user-1",
                List.of(new OrderItem("Pizza", 4990L, 1)), anyDomainAddress());
        when(orderRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(order), PageRequest.of(1, 2), 5));

        PageResponse<OrderResponse> page = orderService.list(null, 1, 2);

        assertThat(page.content()).singleElement()
                .satisfies(item -> assertThat(item.id()).isEqualTo(order.getId()));
        assertThat(page.page()).isEqualTo(1);
        assertThat(page.size()).isEqualTo(2);
        assertThat(page.totalElements()).isEqualTo(5);
        assertThat(page.totalPages()).isEqualTo(3);
        verify(orderRepository, never()).findByStatus(any(), any());
    }

    @Test
    void listWithStatusDelegatesToFindByStatusSortedByNewestFirst() {
        Order order = Order.place("user-1",
                List.of(new OrderItem("Pizza", 4990L, 1)), anyDomainAddress());
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(orderRepository.findByStatus(eq(OrderStatus.RECEBIDO), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(order), PageRequest.of(0, 20), 1));

        PageResponse<OrderResponse> page = orderService.list(OrderStatus.RECEBIDO, 0, 20);

        assertThat(page.content()).hasSize(1);
        verify(orderRepository).findByStatus(eq(OrderStatus.RECEBIDO), pageable.capture());
        assertThat(pageable.getValue().getSort().getOrderFor("createdAt"))
                .isNotNull()
                .satisfies(order2 -> assertThat(order2.getDirection()).isEqualTo(Sort.Direction.DESC));
        verify(orderRepository, never()).findAll(any(Pageable.class));
    }
}
