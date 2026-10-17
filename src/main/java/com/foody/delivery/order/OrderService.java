package com.foody.delivery.order;

import com.foody.delivery.order.dto.CreateOrderRequest;
import com.foody.delivery.order.dto.OrderResponse;
import com.foody.delivery.order.dto.PageResponse;
import com.foody.delivery.shared.exception.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional
    public OrderResponse create(String userId, CreateOrderRequest request) {
        Order order = Order.place(
                userId,
                request.customerName(),
                OrderMapper.toItems(request.items()),
                OrderMapper.toAddress(request.deliveryAddress()));
        orderRepository.save(order);
        return OrderMapper.toResponse(order);
    }

    @Transactional(readOnly = true)
    public OrderResponse getById(String id) {
        return OrderMapper.toResponse(findOrder(id));
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderResponse> list(OrderStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        Page<Order> orders = status == null
                ? orderRepository.findAll(pageable)
                : orderRepository.findByStatus(status, pageable);
        return new PageResponse<>(
                orders.getContent().stream().map(OrderMapper::toResponse).toList(),
                orders.getNumber(),
                orders.getSize(),
                orders.getTotalElements(),
                orders.getTotalPages());
    }

    @Transactional
    public OrderResponse updateStatus(String id, OrderStatus newStatus) {
        Order order = findOrder(id);
        order.changeStatus(newStatus);
        orderRepository.save(order);
        return OrderMapper.toResponse(order);
    }

    private Order findOrder(String id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Order %s not found".formatted(id)));
    }
}
