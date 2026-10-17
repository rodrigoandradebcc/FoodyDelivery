package com.foody.delivery.order;

import com.foody.delivery.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
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
              "customerName": "Ana Souza",
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

    private List<String> contentIds(String pageResponseBody) {
        List<String> ids = new ArrayList<>();
        for (JsonNode order : objectMapper.readTree(pageResponseBody).get("content")) {
            ids.add(order.get("id").asText());
        }
        return ids;
    }

    private List<String> listOrders(String token, String... params) throws Exception {
        var request = get("/api/v1/orders").header("Authorization", "Bearer " + token);
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        return contentIds(mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
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
                .andExpect(jsonPath("$.customerName").value("Ana Souza"))
                .andExpect(jsonPath("$.totalCents").value(11480))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.deliveryAddress.city").value("São Paulo"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void missingCustomerNameReturns400() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON.replace("\"customerName\": \"Ana Souza\",", "")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("customerName")));
    }

    @Test
    void blankAndOverlongCustomerNamesReturn400() throws Exception {
        String token = authToken();
        for (String name : List.of("   ", "x".repeat(121))) {
            mockMvc.perform(post("/api/v1/orders")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(CREATE_ORDER_JSON.replace("Ana Souza", name)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[*].field", hasItem("customerName")));
        }
    }

    @Test
    void locationHeaderPointsAtTheCreatedOrder() throws Exception {
        String token = authToken();
        MockHttpServletResponse created = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON))
                .andExpect(status().isCreated())
                .andReturn().getResponse();
        String createdId = objectMapper.readTree(created.getContentAsString()).get("id").asText();

        String path = URI.create(created.getHeader("Location")).getPath();
        mockMvc.perform(get(path).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(createdId))
                .andExpect(jsonPath("$.totalCents").value(11480));
    }

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
                                  "customerName": "Ana Souza",
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
                                {"customerName": "Ana Souza", "items": [], "deliveryAddress": {
                                  "street": "Rua das Flores", "number": "100", "complement": null,
                                  "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"}}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors").isArray());
    }

    @Test
    void zeroQuantityReturns400WithIndexedFieldName() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "customerName": "Ana Souza",
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

    @Test
    void nullItemElementReturns400WithBareIndexFieldName() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "customerName": "Ana Souza",
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
        String untouchedOrderId = createOrder(token);

        mockMvc.perform(get("/api/v1/orders")
                        .param("page", "0").param("size", "10")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").isNumber());

        String filtered = mockMvc.perform(get("/api/v1/orders")
                        .param("status", "EM_PREPARO")
                        .param("size", "100")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].status", everyItem(is("EM_PREPARO"))))
                .andReturn().getResponse().getContentAsString();
        assertThat(contentIds(filtered)).contains(orderId);

        assertThat(contentIds(filtered)).doesNotContain(untouchedOrderId);
    }

    @Test
    void listPaginatesAcrossManyOrdersWithEagerItems() throws Exception {
        String token = authToken();
        for (int i = 0; i < 5; i++) {
            createOrder(token);
        }

        String firstPage = mockMvc.perform(get("/api/v1/orders")
                        .param("page", "0").param("size", "2")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.content[*].items.length()", everyItem(is(2))))
                .andReturn().getResponse().getContentAsString();

        String secondPage = mockMvc.perform(get("/api/v1/orders")
                        .param("page", "1").param("size", "2")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.content[*].items.length()", everyItem(is(2))))
                .andReturn().getResponse().getContentAsString();

        List<String> firstIds = contentIds(firstPage);
        List<String> secondIds = contentIds(secondPage);

        assertThat(firstIds).doesNotContainAnyElementsOf(secondIds);
        assertThat(firstIds).doesNotHaveDuplicates();
        assertThat(secondIds).doesNotHaveDuplicates();

        List<String> unpaginated = listOrders(token, "page", "0", "size", "100");
        List<String> concatenated = new ArrayList<>(firstIds);
        concatenated.addAll(secondIds);
        assertThat(concatenated).isEqualTo(unpaginated.subList(0, 4));
    }

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
    void sizeAboveOneHundredReturns400() throws Exception {
        String token = authToken();
        mockMvc.perform(get("/api/v1/orders")
                        .param("size", "101")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("size")));

        mockMvc.perform(get("/api/v1/orders")
                        .param("size", "100")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void unknownStatusFilterReturns400WithFieldNamedProblemDetail() throws Exception {
        String token = authToken();
        mockMvc.perform(get("/api/v1/orders")
                        .param("status", "NAO_EXISTE")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("status")));
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
    void cancelAfterDispatchReturns200() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);
        patchStatus(token, orderId, "EM_PREPARO", status().isOk());
        patchStatus(token, orderId, "SAIU_PARA_ENTREGA", status().isOk());
        patchStatus(token, orderId, "CANCELADO", status().isOk());
        mockMvc.perform(get("/api/v1/orders/" + orderId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELADO"));
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

    @Test
    void garbageTokenReturnsUnauthorizedProblemDetail() throws Exception {
        mockMvc.perform(get("/api/v1/orders")
                        .header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("WWW-Authenticate"))
                .andExpect(header().string("Content-Type", "application/problem+json"))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Unauthorized"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.detail").isNotEmpty())
                .andExpect(jsonPath("$.instance").value("/api/v1/orders"));
    }

    @Test
    void fractionalPriceIsRejectedInsteadOfTruncated() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON.replace("\"unitPriceCents\": 4990", "\"unitPriceCents\": 49.99")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("items[0].unitPriceCents")));
    }

    @Test
    void hugePriceReturns400InsteadOfANegativeTotal() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON.replace("\"unitPriceCents\": 4990",
                                "\"unitPriceCents\": 9223372036854775807")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("items[0].unitPriceCents")));
    }
}
