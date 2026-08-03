package com.foody.delivery.order;

import com.foody.delivery.order.dto.CreateOrderRequest;
import com.foody.delivery.order.dto.OrderResponse;
import com.foody.delivery.order.dto.PageResponse;
import com.foody.delivery.order.dto.UpdateStatusRequest;
import jakarta.validation.Valid;
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

    /**
     * The list query parameters, bound as a validated object rather than as bare
     * {@code @RequestParam}s. This is deliberate and load-bearing.
     *
     * <p>{@code OrderService.list} hands {@code page}/{@code size} straight to
     * {@code PageRequest.of}, which throws {@code IllegalArgumentException} for
     * {@code page < 0} or {@code size < 1}. {@code ApiExceptionHandler} has no
     * {@code IllegalArgumentException} handler -- on purpose, so genuine internal bugs stay
     * 500s -- so {@code ?page=-1} used to be an HTTP 500.
     *
     * <p>The obvious fix, {@code @Validated} on the controller plus {@code @Min} on the
     * {@code @RequestParam}s, only swaps the failure for a {@code ConstraintViolationException},
     * which the advice does not handle either: still a 500. Binding the parameters into this
     * object instead makes {@code ModelAttributeMethodProcessor} throw a
     * {@code MethodArgumentNotValidException} -- the exception the advice already turns into a
     * 400 with the {@code errors} extension. Bad enum values and non-numeric page/size land on
     * the same path as binding errors.
     *
     * <p><b>What is load-bearing is the object binding, NOT the {@code @ModelAttribute}
     * annotation.</b> Spring's last-resort {@code ServletModelAttributeMethodProcessor} is
     * registered with {@code annotationNotRequired = true}, so it claims this non-simple
     * parameter and honours {@code @Valid} whether or not the annotation is present. Verified
     * by experiment: with {@code @ModelAttribute} deleted the full suite still passes 102/102,
     * including {@code negativePageReturns400NotAn500}, {@code zeroSizeReturns400NotAn500} and
     * {@code unknownStatusFilterReturns400WithFieldNamedProblemDetail}. It is kept only because
     * it states the intent explicitly. Do not infer from its presence that removing it would
     * reintroduce the 500 -- switching back to three bare {@code @RequestParam}s would.
     *
     * <p>The compact constructor supplies the defaults that {@code @RequestParam(defaultValue)}
     * used to: an absent parameter binds to {@code null}, not to a value that would fail
     * validation. Hence the documented default of {@code size = 20} and {@code page = 0}.
     *
     * <p>{@code @ParameterObject} is the annotation here whose removal IS silently destructive,
     * and it affects only the OpenAPI document, not binding. Without it springdoc documents this
     * record as a single opaque {@code query} parameter with a {@code $ref} to a
     * {@code ListQuery} schema, and Swagger UI renders one unusable "query * object" box instead
     * of three fields; runtime behaviour is unchanged, so nothing but the generated spec tells
     * you. Also verified by experiment: removing it fails
     * {@code SwaggerIntegrationTest.listDocumentsStatusPageAndSizeAsThreeSeparateQueryParameters}
     * with {@code parameters.length() expected:<3> but was:<1>}.
     */
    public record ListQuery(OrderStatus status, @Min(0) Integer page, @Min(1) Integer size) {

        public ListQuery {
            page = (page == null) ? 0 : page;
            size = (size == null) ? 20 : size;
        }
    }
}
