package com.foody.delivery.order;

import com.foody.delivery.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Guards the OpenAPI document and the Swagger UI a reviewer actually uses.
 *
 * <p>Note the split of responsibility with {@code SecurityIntegrationTest}: that class owns the
 * question "is {@code /v3/api-docs} permitted?". This class owns "does the document say the right
 * thing, and can the UI load every asset it needs?".
 */
class SwaggerIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    @Test
    void openApiDocsArePublic() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("FoodyDelivery API"))
                .andExpect(jsonPath("$.info.version").value("v1"))
                .andExpect(jsonPath("$.paths['/api/v1/orders']").exists());
    }

    /**
     * The "Authorize" button in the UI only appears, and only sends an {@code Authorization}
     * header, if the document declares an HTTP bearer scheme AND requires it.
     */
    @Test
    void documentDeclaresAndRequiresTheBearerJwtScheme() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.securitySchemes['bearer-jwt'].type").value("http"))
                .andExpect(jsonPath("$.components.securitySchemes['bearer-jwt'].scheme").value("bearer"))
                .andExpect(jsonPath("$.components.securitySchemes['bearer-jwt'].bearerFormat").value("JWT"))
                .andExpect(jsonPath("$.security[0]['bearer-jwt']").exists());
    }

    /**
     * Regression guard for the {@code @ParameterObject} on {@code OrderController.list}.
     *
     * <p>{@code list} binds its parameters into the {@code ListQuery} record rather than taking
     * three bare {@code @RequestParam}s (see the javadoc on that record for why). Left alone,
     * springdoc documents that record as ONE opaque parameter named {@code query} whose schema is
     * a {@code $ref} to {@code ListQuery} -- Swagger UI then renders a single unusable
     * "query * object" text box and a reviewer cannot filter or page by hand. Asserting only that
     * {@code /v3/api-docs} returns 200 would not catch that.
     */
    @Test
    void listDocumentsStatusPageAndSizeAsThreeSeparateQueryParameters() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                // Exactly three, and nothing was collapsed into an object or a body.
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters.length()").value(3))
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.requestBody").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[*].name")
                        .value(containsInAnyOrder("status", "page", "size")))
                // Every one of them is a query parameter, not a body/path/header parameter.
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[*].in")
                        .value(everyItem(equalTo("query"))))
                // No parameter is a $ref to a wrapper schema, and the wrapper schema is gone.
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[*].schema.$ref")
                        .doesNotExist())
                .andExpect(jsonPath("$.components.schemas.ListQuery").doesNotExist())
                // The enum and the @Min bounds survive, so the UI renders a dropdown and validates.
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[?(@.name=='status')].schema.enum[*]")
                        .value(hasItems(
                                "RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE", "CANCELADO")))
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[?(@.name=='page')].schema.minimum")
                        .value(contains(0)))
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[?(@.name=='size')].schema.minimum")
                        .value(contains(1)));
    }

    /**
     * The UI is only usable if every asset it pulls is reachable while unauthenticated.
     *
     * <p>{@code SecurityConfig} permits {@code /swagger-ui/**} and {@code /v3/api-docs/**} but NOT
     * {@code /webjars/**}, so this pins the assumption that springdoc serves the whole bundle --
     * including {@code swagger-initializer.js} and the {@code swagger-config} the initializer
     * fetches -- from under those two permitted prefixes. If a springdoc upgrade ever moves an
     * asset to {@code /webjars/**}, this fails with a 401 instead of the UI silently breaking.
     */
    @Test
    void everyAssetTheSwaggerUiLoadsIsReachableWithoutAuthentication() throws Exception {
        String[] assets = {
                "/swagger-ui/index.html",
                "/swagger-ui/index.css",
                "/swagger-ui/swagger-ui.css",
                "/swagger-ui/swagger-ui-bundle.js",
                "/swagger-ui/swagger-ui-standalone-preset.js",
                "/swagger-ui/swagger-initializer.js",
                "/swagger-ui/favicon-32x32.png",
                "/swagger-ui/favicon-16x16.png",
                "/v3/api-docs/swagger-config",
                "/v3/api-docs"
        };
        for (String asset : assets) {
            int statusCode = mockMvc.perform(get(asset)).andReturn().getResponse().getStatus();
            assertThat(statusCode)
                    .as("GET %s must not be rejected by security", asset)
                    .isNotIn(401, 403);
            assertThat(statusCode)
                    .as("GET %s must be served", asset)
                    .isEqualTo(200);
        }
    }

    /** {@code /swagger-ui.html} is the URL a human types; it must land on the real UI. */
    @Test
    void swaggerUiHtmlRedirectsToTheUi() throws Exception {
        String location = mockMvc.perform(get("/swagger-ui.html"))
                .andExpect(status().is3xxRedirection())
                .andReturn().getResponse().getHeader("Location");

        assertThat(location).contains("/swagger-ui/index.html");
    }

    /**
     * The published document is the most public surface in the app. Nothing in it may leak the
     * signing key, a stored password hash, or the on-disk database path.
     */
    @Test
    void documentExposesNoKeyMaterialHashesOrDatabasePath() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();

        assertThat(body).doesNotContain("PRIVATE KEY");
        assertThat(body).doesNotContainIgnoringCase("privateKey");
        assertThat(body).doesNotContainIgnoringCase("passwordHash");
        assertThat(body).doesNotContainIgnoringCase("password_hash");
        assertThat(body).doesNotContain("$2a$");
        assertThat(body).doesNotContain("foody.db");
        assertThat(body).doesNotContain("jdbc:sqlite");

        // The User entity is never exposed as a schema; only the auth DTOs are.
        assertThat(body).doesNotContain("\"User\"");
    }
}
