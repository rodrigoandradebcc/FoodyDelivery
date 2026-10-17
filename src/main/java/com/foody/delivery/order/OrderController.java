package com.foody.delivery.order;

import com.foody.delivery.order.dto.CreateOrderRequest;
import com.foody.delivery.order.dto.OrderResponse;
import com.foody.delivery.order.dto.PageResponse;
import com.foody.delivery.order.dto.UpdateStatusRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<OrderResponse> create(@AuthenticationPrincipal Jwt jwt,
                                                @Valid @RequestBody CreateOrderRequest request) {
        OrderResponse response = orderService.create(jwt.getSubject(), request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(response.id())
                .toUri();
        return ResponseEntity.created(location).body(response);
    }

    @GetMapping
    public PageResponse<OrderResponse> list(@Valid @ModelAttribute @ParameterObject ListQuery query) {
        return orderService.list(query.status(), query.page(), query.size());
    }

    @GetMapping("/{id}")
    public OrderResponse getById(@PathVariable String id) {
        return orderService.getById(id);
    }

    @PatchMapping("/{id}/status")
    public OrderResponse updateStatus(@PathVariable String id,
                                      @Valid @RequestBody UpdateStatusRequest request) {
        return orderService.updateStatus(id, request.status());
    }

    public record ListQuery(OrderStatus status, @Min(0) Integer page,
                            @Min(1) @Max(100) Integer size) {

        public ListQuery {
            page = (page == null) ? 0 : page;
            size = (size == null) ? 20 : size;
        }
    }
}
