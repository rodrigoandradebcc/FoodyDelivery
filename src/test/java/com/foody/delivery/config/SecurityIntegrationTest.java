package com.foody.delivery.config;

import com.foody.delivery.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SecurityIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    @Autowired
    private JwtEncoder jwtEncoder;

    @Test
    void ordersWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ordersWithGarbageTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/orders")
                        .header("Authorization", "Bearer not-a-real-jwt"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * Proves the boot-generated {@code JwtDecoder} bean is the one the resource-server
     * filter uses: a token signed by our own {@code JwtEncoder} passes authentication and
     * reaches the dispatcher, which 404s because no handler is mapped to this probe path.
     * The path is deliberately one no controller will ever map, so this stays true
     * after later tasks add real endpoints.
     */
    @Test
    void selfIssuedTokenAuthenticatesAndReachesTheDispatcher() throws Exception {
        Instant now = Instant.now();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(JwtClaimsSet.builder()
                .subject("user-1")
                .claim("email", "rodrigo@example.com")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .build())).getTokenValue();

        mockMvc.perform(get("/api/v1/__security-probe__")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void apiDocsIsPublic() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk());
    }
}
