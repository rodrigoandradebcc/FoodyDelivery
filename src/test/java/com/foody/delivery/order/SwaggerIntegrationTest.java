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

    @Test
    void documentDeclaresAndRequiresTheBearerJwtScheme() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.securitySchemes['bearer-jwt'].type").value("http"))
                .andExpect(jsonPath("$.components.securitySchemes['bearer-jwt'].scheme").value("bearer"))
                .andExpect(jsonPath("$.components.securitySchemes['bearer-jwt'].bearerFormat").value("JWT"))
                .andExpect(jsonPath("$.security[0]['bearer-jwt']").exists());
    }

    @Test
    void listDocumentsStatusPageAndSizeAsThreeSeparateQueryParameters() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters.length()").value(3))
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.requestBody").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[*].name")
                        .value(containsInAnyOrder("status", "page", "size")))
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[*].in")
                        .value(everyItem(equalTo("query"))))
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[*].schema.$ref")
                        .doesNotExist())
                .andExpect(jsonPath("$.components.schemas.ListQuery").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[?(@.name=='status')].schema.enum[*]")
                        .value(hasItems(
                                "RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE", "CANCELADO")))
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[?(@.name=='page')].schema.minimum")
                        .value(contains(0)))
                .andExpect(jsonPath("$.paths['/api/v1/orders'].get.parameters[?(@.name=='size')].schema.minimum")
                        .value(contains(1)));
    }

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

    @Test
    void swaggerUiHtmlRedirectsToTheUi() throws Exception {
        String location = mockMvc.perform(get("/swagger-ui.html"))
                .andExpect(status().is3xxRedirection())
                .andReturn().getResponse().getHeader("Location");

        assertThat(location).contains("/swagger-ui/index.html");
    }

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

        assertThat(body).doesNotContain("\"User\"");
    }
}
