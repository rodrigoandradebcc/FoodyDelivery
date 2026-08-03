package com.foody.delivery.order;

import com.foody.delivery.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderFlowIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    private static final String CREATE_ORDER_JSON = """
            {
              "items": [
                { "productName": "Pizza Calabresa", "unitPriceCents": 4990, "quantity": 2 },
                { "productName": "Guaraná 2L", "unitPriceCents": 1500, "quantity": 1 }
              ],
              "deliveryAddress": {
                "street": "Rua das Flores", "number": "100", "complement": null,
                "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"
              }
            }
            """;

    private String authToken() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Test User", "email": "%s", "password": "senha-forte-123"}
                                """.formatted(email)))
                .andExpect(status().isCreated());
        String body = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "%s", "password": "senha-forte-123"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("accessToken").asText();
    }

    private String createOrder(String token) throws Exception {
        String body = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    private void patchStatus(String token, String orderId, String newStatus,
                             org.springframework.test.web.servlet.ResultMatcher expected) throws Exception {
        mockMvc.perform(patch("/api/v1/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"" + newStatus + "\"}"))
                .andExpect(expected);
    }

    @Test
    void createOrderComputesTotalServerSideAndReturnsLocation() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/v1/orders/")))
                .andExpect(jsonPath("$.status").value("RECEBIDO"))
                .andExpect(jsonPath("$.totalCents").value(11480))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.deliveryAddress.city").value("São Paulo"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    /**
     * The Location header must actually resolve: a client that follows it gets the order.
     */
    @Test
    void locationHeaderPointsAtTheCreatedOrder() throws Exception {
        String token = authToken();
        String location = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");

        String path = java.net.URI.create(location).getPath();
        mockMvc.perform(get(path).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCents").value(11480));
    }

    /**
     * {@code total_cents} is ALWAYS computed server-side. A payload that carries its own
     * total must not influence the stored value in any way.
     */
    @Test
    void clientSuppliedTotalIsIgnored() throws Exception {
        String token = authToken();
        String body = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "totalCents": 1,
                                  "total_cents": 1,
                                  "items": [
                                    { "productName": "Pizza Calabresa", "unitPriceCents": 4990, "quantity": 2 },
                                    { "productName": "Guaraná 2L", "unitPriceCents": 1500, "quantity": 1 }
                                  ],
                                  "deliveryAddress": {
                                    "street": "Rua das Flores", "number": "100", "complement": null,
                                    "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"
                                  }
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalCents").value(11480))
                .andReturn().getResponse().getContentAsString();

        // And the value that was persisted -- not just the one echoed back -- is the computed sum.
        String orderId = objectMapper.readTree(body).get("id").asText();
        mockMvc.perform(get("/api/v1/orders/" + orderId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCents").value(11480));
    }

    @Test
    void createOrderWithoutItemsReturns400() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items": [], "deliveryAddress": {
                                  "street": "Rua das Flores", "number": "100", "complement": null,
                                  "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"}}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors").isArray());
    }

    /**
     * The per-item constraints on {@code OrderItemRequest} only run because the controller
     * declares {@code @Valid @RequestBody}. The emitted field name is the indexed path.
     */
    @Test
    void zeroQuantityReturns400WithIndexedFieldName() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "items": [
                                    { "productName": "Pizza Calabresa", "unitPriceCents": 4990, "quantity": 0 }
                                  ],
                                  "deliveryAddress": {
                                    "street": "Rua das Flores", "number": "100", "complement": null,
                                    "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("items[0].quantity")));
    }

    /**
     * A null element in the items array. Bean Validation reports the path as
     * {@code items[0].<list element>}, but Spring's {@code SpringValidatorAdapter} drops
     * nodes whose name starts with {@code <}, so what the API emits is plain {@code items[0]}.
     */
    @Test
    void nullItemElementReturns400WithBareIndexFieldName() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "items": [null],
                                  "deliveryAddress": {
                                    "street": "Rua das Flores", "number": "100", "complement": null,
                                    "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("items[0]")));
    }

    @Test
    void getByIdReturnsOrderAndUnknownIdReturns404() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);

        mockMvc.perform(get("/api/v1/orders/" + orderId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(orderId));

        mockMvc.perform(get("/api/v1/orders/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }

    @Test
    void listIsPaginatedAndFiltersByStatus() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);
        patchStatus(token, orderId, "EM_PREPARO", status().isOk());
        createOrder(token);

        mockMvc.perform(get("/api/v1/orders")
                        .param("page", "0").param("size", "10")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").isNumber());

        mockMvc.perform(get("/api/v1/orders")
                        .param("status", "EM_PREPARO")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].status", everyItem(is("EM_PREPARO"))));
    }

    /**
     * Multi-order fixture: pagination must really slice the result set, and every returned
     * order must carry its EAGER-fetched items. {@code Order.items} is {@code fetch = EAGER},
     * so this is also the fixture that exposes how Hibernate applies the limit (see the
     * task report for the HHH000104 finding).
     */
    @Test
    void listPaginatesAcrossManyOrdersWithEagerItems() throws Exception {
        String token = authToken();
        for (int i = 0; i < 5; i++) {
            createOrder(token);
        }

        mockMvc.perform(get("/api/v1/orders")
                        .param("page", "0").param("size", "2")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(5)))
                // The EAGER collection survives pagination: each row still has both items.
                .andExpect(jsonPath("$.content[*].items.length()", everyItem(is(2))));

        mockMvc.perform(get("/api/v1/orders")
                        .param("page", "1").param("size", "2")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.page").value(1));
    }

    /**
     * {@code OrderService.list} hands page/size straight to {@code PageRequest.of}, which
     * throws {@code IllegalArgumentException} -- an exception {@code ApiExceptionHandler}
     * deliberately does not handle. Without the validated query object these two requests
     * are HTTP 500s. Adding {@code @Validated} + {@code @Min} on the {@code @RequestParam}s
     * would have swapped them for an equally unhandled {@code ConstraintViolationException},
     * i.e. still 500.
     */
    @Test
    void negativePageReturns400NotAn500() throws Exception {
        String token = authToken();
        mockMvc.perform(get("/api/v1/orders")
                        .param("page", "-1")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("page")));
    }

    @Test
    void zeroSizeReturns400NotAn500() throws Exception {
        String token = authToken();
        mockMvc.perform(get("/api/v1/orders")
                        .param("size", "0")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("size")));
    }

    @Test
    void unknownStatusFilterReturns400() throws Exception {
        String token = authToken();
        mockMvc.perform(get("/api/v1/orders")
                        .param("status", "NAO_EXISTE")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void statusAdvancesThroughHappyPathAndIllegalTransitionReturns409() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);

        patchStatus(token, orderId, "EM_PREPARO", status().isOk());
        patchStatus(token, orderId, "SAIU_PARA_ENTREGA", status().isOk());
        patchStatus(token, orderId, "ENTREGUE", status().isOk());

        mockMvc.perform(patch("/api/v1/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"EM_PREPARO\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.title").value("Invalid status transition"))
                .andExpect(jsonPath("$.detail")
                        .value("Cannot change status from ENTREGUE to EM_PREPARO"))
                .andExpect(jsonPath("$.instance")
                        .value("/api/v1/orders/" + orderId + "/status"));
    }

    @Test
    void skippingAStateReturns409() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);
        patchStatus(token, orderId, "ENTREGUE", status().isConflict());
    }

    @Test
    void cancelAfterDispatchReturns409() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);
        patchStatus(token, orderId, "EM_PREPARO", status().isOk());
        patchStatus(token, orderId, "SAIU_PARA_ENTREGA", status().isOk());
        patchStatus(token, orderId, "CANCELADO", status().isConflict());
    }

    @Test
    void patchStatusOnUnknownOrderReturns404() throws Exception {
        String token = authToken();
        patchStatus(token, UUID.randomUUID().toString(), "EM_PREPARO", status().isNotFound());
    }

    @Test
    void patchStatusWithUnknownStatusValueReturns400() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);
        patchStatus(token, orderId, "NAO_EXISTE", status().isBadRequest());
    }

    /**
     * Any authenticated user may see any order: there are no roles in this API, and no
     * JwtAuthenticationConverter, so authorities are empty and only {@code authenticated()}
     * is enforced.
     */
    @Test
    void anotherAuthenticatedUserCanReadAndAdvanceTheOrder() throws Exception {
        String owner = authToken();
        String orderId = createOrder(owner);
        String stranger = authToken();

        mockMvc.perform(get("/api/v1/orders/" + orderId)
                        .header("Authorization", "Bearer " + stranger))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(orderId));
        patchStatus(stranger, orderId, "EM_PREPARO", status().isOk());
    }

    @Test
    void allOrderEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/orders")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/orders/some-id")).andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/v1/orders/some-id/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"EM_PREPARO\"}"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * Filter-chain 401s carry an empty body and a {@code WWW-Authenticate} challenge -- they
     * never reach {@code ApiExceptionHandler}, so no ProblemDetail can be asserted on them.
     */
    @Test
    void garbageTokenIsRejectedByTheFilterChainWithEmptyBody() throws Exception {
        mockMvc.perform(get("/api/v1/orders")
                        .header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("WWW-Authenticate"))
                .andExpect(result -> org.assertj.core.api.Assertions
                        .assertThat(result.getResponse().getContentAsString()).isEmpty());
    }
}
