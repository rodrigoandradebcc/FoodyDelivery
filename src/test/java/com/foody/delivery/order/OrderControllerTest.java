package com.foody.delivery.order;

import com.foody.delivery.config.SecurityConfig;
import com.foody.delivery.order.dto.AddressDto;
import com.foody.delivery.order.dto.CreateOrderRequest;
import com.foody.delivery.order.dto.OrderItemRequest;
import com.foody.delivery.order.dto.OrderItemResponse;
import com.foody.delivery.order.dto.OrderResponse;
import com.foody.delivery.order.dto.PageResponse;
import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.shared.exception.NotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OrderService orderService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    private static final String CREATE_ORDER_JSON = """
            {
              "items": [{"productName": "Pizza Calabresa", "unitPriceCents": 4990, "quantity": 2}],
              "deliveryAddress": {
                "street": "Rua das Flores", "number": "100", "complement": null,
                "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"
              }
            }
            """;

    private static OrderResponse response(String status) {
        Instant now = Instant.parse("2026-07-31T13:00:00Z");
        return new OrderResponse("order-1", status, 9980L,
                List.of(new OrderItemResponse("Pizza Calabresa", 4990L, 2)),
                new AddressDto("Rua das Flores", "100", null, "Centro", "São Paulo", "SP", "01001000"),
                now, now);
    }

    @Test
    void everyEndpointRejectsAnonymousCallsWith401() throws Exception {
        mockMvc.perform(get("/api/v1/orders")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/orders/order-1")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content(CREATE_ORDER_JSON))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/v1/orders/order-1/status").contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\": \"EM_PREPARO\"}")).andExpect(status().isUnauthorized());
    }

    @Test
    void createPassesTheJwtSubjectAndTheParsedBodyToTheServiceAndAnswers201WithLocation() throws Exception {
        CreateOrderRequest expected = new CreateOrderRequest(
                List.of(new OrderItemRequest("Pizza Calabresa", 4990L, 2)),
                new AddressDto("Rua das Flores", "100", null, "Centro", "São Paulo", "SP", "01001000"));
        when(orderService.create("user-1", expected)).thenReturn(response("RECEBIDO"));

        mockMvc.perform(post("/api/v1/orders").with(jwt().jwt(token -> token.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_ORDER_JSON))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", endsWith("/api/v1/orders/order-1")))
                .andExpect(jsonPath("$.id").value("order-1"))
                .andExpect(jsonPath("$.totalCents").value(9980));
    }

    @Test
    void createWithInvalidBodyNeverReachesTheService() throws Exception {
        mockMvc.perform(post("/api/v1/orders").with(jwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON.replace("\"quantity\": 2", "\"quantity\": 0")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[0].field").value("items[0].quantity"));
        verify(orderService, never()).create(any(), any());
    }

    @Test
    void listForwardsStatusPageAndSize() throws Exception {
        when(orderService.list(OrderStatus.EM_PREPARO, 2, 5))
                .thenReturn(new PageResponse<>(List.of(response("EM_PREPARO")), 2, 5, 11, 3));

        mockMvc.perform(get("/api/v1/orders").with(jwt())
                        .param("status", "EM_PREPARO").param("page", "2").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].status").value("EM_PREPARO"))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.totalElements").value(11))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void listWithoutParametersUsesFirstPageOfTwentyAndNoFilter() throws Exception {
        when(orderService.list(null, 0, 20)).thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

        mockMvc.perform(get("/api/v1/orders").with(jwt())).andExpect(status().isOk());

        verify(orderService).list(null, 0, 20);
    }

    @Test
    void emptyStatusParameterMeansNoFilter() throws Exception {
        when(orderService.list(null, 0, 20)).thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

        mockMvc.perform(get("/api/v1/orders").with(jwt()).param("status", "")).andExpect(status().isOk());

        verify(orderService).list(null, 0, 20);
    }

    @Test
    void getByIdReturnsTheOrderAndMapsNotFoundTo404() throws Exception {
        when(orderService.getById("order-1")).thenReturn(response("RECEBIDO"));
        when(orderService.getById("not-a-uuid-but-still-a-path-segment"))
                .thenThrow(new NotFoundException("Order not-a-uuid-but-still-a-path-segment not found"));

        mockMvc.perform(get("/api/v1/orders/order-1").with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("order-1"));
        mockMvc.perform(get("/api/v1/orders/not-a-uuid-but-still-a-path-segment").with(jwt()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"))
                .andExpect(jsonPath("$.detail").value("Order not-a-uuid-but-still-a-path-segment not found"))
                .andExpect(jsonPath("$.instance").value("/api/v1/orders/not-a-uuid-but-still-a-path-segment"));
    }

    @Test
    void updateStatusForwardsTheParsedStatusAndMapsConflictTo409() throws Exception {
        when(orderService.updateStatus("order-1", OrderStatus.EM_PREPARO)).thenReturn(response("EM_PREPARO"));
        when(orderService.updateStatus("order-1", OrderStatus.ENTREGUE)).thenThrow(
                new ConflictException("Invalid status transition", "Cannot change status from RECEBIDO to ENTREGUE"));

        mockMvc.perform(patch("/api/v1/orders/order-1/status").with(jwt())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\": \"EM_PREPARO\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_PREPARO"));
        mockMvc.perform(patch("/api/v1/orders/order-1/status").with(jwt())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\": \"ENTREGUE\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid status transition"))
                .andExpect(jsonPath("$.detail").value("Cannot change status from RECEBIDO to ENTREGUE"))
                .andExpect(jsonPath("$.instance").value("/api/v1/orders/order-1/status"));
    }

    @Test
    void missingStatusInTheBodyIs400NamingTheField() throws Exception {
        mockMvc.perform(patch("/api/v1/orders/order-1/status").with(jwt())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("status"))
                .andExpect(jsonPath("$.errors[0].message").value("must not be null"));
        verify(orderService, never()).updateStatus(any(), any());
    }

    @Test
    void malformedJsonIs400ProblemDetail() throws Exception {
        mockMvc.perform(post("/api/v1/orders").with(jwt())
                        .contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Malformed request body"))
                .andExpect(jsonPath("$.detail").value("Request body is missing or malformed"));
    }

    @Test
    void unknownStatusValueInTheBodyIs400NamingTheFieldAndTheAllowedValues() throws Exception {
        mockMvc.perform(patch("/api/v1/orders/order-1/status").with(jwt())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\": \"NAO_EXISTE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[0].field").value("status"))
                .andExpect(jsonPath("$.errors[0].message")
                        .value("must be one of [RECEBIDO, EM_PREPARO, SAIU_PARA_ENTREGA, ENTREGUE, CANCELADO]"));
        verify(orderService, never()).updateStatus(any(), any());
    }

    @Test
    void nonNumericQuantityIs400NamingTheField() throws Exception {
        mockMvc.perform(post("/api/v1/orders").with(jwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON.replace("\"quantity\": 2", "\"quantity\": \"two\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[0].field").value("items[0].quantity"))
                .andExpect(jsonPath("$.errors[0].message").value("invalid value 'two'"));
    }

    @Test
    void fractionalQuantityIs400NamingTheFieldInsteadOfSilentTruncation() throws Exception {
        mockMvc.perform(post("/api/v1/orders").with(jwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON.replace("\"quantity\": 2", "\"quantity\": 2.5")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[0].field").value("items[0].quantity"));
        verify(orderService, never()).create(any(), any());
    }

    @Test
    void numericStringsAreStillCoerced() throws Exception {
        CreateOrderRequest expected = new CreateOrderRequest(
                List.of(new OrderItemRequest("Pizza Calabresa", 4990L, 2)),
                new AddressDto("Rua das Flores", "100", null, "Centro", "São Paulo", "SP", "01001000"));
        when(orderService.create("user-1", expected)).thenReturn(response("RECEBIDO"));

        mockMvc.perform(post("/api/v1/orders").with(jwt().jwt(token -> token.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON.replace("\"unitPriceCents\": 4990", "\"unitPriceCents\": \"4990\"")))
                .andExpect(status().isCreated());
    }

    @Test
    void bindingFailuresOnQueryParametersDoNotLeakClassNames() throws Exception {
        mockMvc.perform(get("/api/v1/orders").with(jwt()).param("status", "NAO_EXISTE"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("status"))
                .andExpect(jsonPath("$.errors[0].message").value("invalid value 'NAO_EXISTE'"));
        mockMvc.perform(get("/api/v1/orders").with(jwt()).param("page", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("page"))
                .andExpect(jsonPath("$.errors[0].message").value("invalid value 'abc'"));
    }

    @Test
    void unsupportedMethodIs405ProblemDetailWithAllowHeader() throws Exception {
        mockMvc.perform(delete("/api/v1/orders/order-1").with(jwt()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().string("Allow", containsString("GET")))
                .andExpect(jsonPath("$.title").value("Method not allowed"))
                .andExpect(jsonPath("$.detail").value("Method DELETE is not supported for this resource"))
                .andExpect(jsonPath("$.instance").value("/api/v1/orders/order-1"));
    }

    @Test
    void missingOrWrongContentTypeIs415ProblemDetail() throws Exception {
        mockMvc.perform(post("/api/v1/orders").with(jwt()).content(CREATE_ORDER_JSON))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.title").value("Unsupported media type"));
        mockMvc.perform(post("/api/v1/orders").with(jwt()).contentType(MediaType.TEXT_PLAIN).content(CREATE_ORDER_JSON))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.detail").value("Content-Type must be application/json"));
    }

    @Test
    void unknownPathIs404ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/v1/orders/order-1/items").with(jwt()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"))
                .andExpect(jsonPath("$.detail").value("No resource at /api/v1/orders/order-1/items"));
    }
}
