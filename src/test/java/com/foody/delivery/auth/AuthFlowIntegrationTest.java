package com.foody.delivery.auth;

import com.foody.delivery.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthFlowIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    @Autowired
    private JwtDecoder jwtDecoder;

    private static String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    private static String registerJson(String email) {
        return """
                {"name": "Rodrigo", "email": "%s", "password": "senha-forte-123"}
                """.formatted(email);
    }

    private static String loginJson(String email, String password) {
        return """
                {"email": "%s", "password": "%s"}
                """.formatted(email, password);
    }

    @Test
    void registerReturns201WithoutExposingPasswordHash() throws Exception {
        String email = uniqueEmail();
        String body = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Rodrigo"))
                .andExpect(jsonPath("$.email").value(email))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContainIgnoringCase("password");
    }

    @Test
    void duplicateEmailReturns409ProblemDetail() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.title").value("E-mail already registered"))
                .andExpect(jsonPath("$.instance").value("/api/v1/auth/register"));
    }

    /**
     * The payload violates three constraints, so the assertion names all three fields. Asserting
     * only that {@code errors} is a non-empty array would be satisfied by a broken implementation:
     * with {@code @Email} deleted from {@code RegisterRequest.email} and {@code @Size(min = 8)}
     * from {@code password}, the {@code @NotBlank} on {@code name} alone still produces a
     * one-element array and the weaker test still passed. Both halves were verified by
     * experiment: with {@code @Email} deleted the OLD assertion still reported BUILD SUCCESS,
     * while this one fails with {@code Expected: (a collection containing "name" and a collection
     * containing "email" and a collection containing "password") but: a collection containing
     * "email" mismatches were: [was "password", was "name"]}.
     */
    @Test
    void invalidRegisterPayloadReturns400WithFieldErrors() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "", "email": "not-an-email", "password": "123"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.errors[*].field", hasItems("name", "email", "password")));
    }

    /**
     * BCrypt's limit is 72 BYTES; {@code @Size(max = 72)} only counts characters. Nineteen
     * emoji are 38 characters but 76 bytes, so before the {@code @MaxBytes} constraint this
     * payload sailed past validation and blew up inside {@code BCryptPasswordEncoder.encode}
     * with an {@code IllegalArgumentException}, which no advice handles — an HTTP 500 with a
     * non-ProblemDetail body. It must now be an ordinary 400 that names the field.
     */
    @Test
    void passwordOver72BytesReturns400NotAn500() throws Exception {
        String emojiPassword = "🍕".repeat(19); // 38 chars, 76 UTF-8 bytes
        assertThat(emojiPassword.length()).isLessThanOrEqualTo(72);
        assertThat(emojiPassword.getBytes(StandardCharsets.UTF_8).length).isGreaterThan(72);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Rodrigo", "email": "%s", "password": "%s"}
                                """.formatted(uniqueEmail(), emojiPassword)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("password")));
    }

    /**
     * Guards {@link AuthService#DUMMY_PASSWORD_HASH}: if that constant were ever mangled into
     * something BCrypt does not recognise, {@code matches} would bail out immediately instead
     * of doing a full verification, and the unknown-e-mail timing leak would silently return.
     * A timing assertion would be flaky, so this pins the property that makes the work real.
     */
    @Test
    void dummyPasswordHashIsAGenuineBcrypt10Hash() {
        assertThat(AuthService.DUMMY_PASSWORD_HASH).matches("^\\$2a\\$10\\$[./A-Za-z0-9]{53}$");
    }

    @Test
    void loginReturnsBearerTokenWithOneHourExpiry() throws Exception {
        String email = uniqueEmail();
        String registerBody = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String userId = objectMapper.readTree(registerBody).get("id").asText();

        String loginBody = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "senha-forte-123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(3600))
                .andReturn().getResponse().getContentAsString();

        // The token really carries sub = user id, the e-mail claim and a one-hour expiry.
        Jwt jwt = jwtDecoder.decode(objectMapper.readTree(loginBody).get("accessToken").asText());
        assertThat(jwt.getSubject()).isEqualTo(userId);
        assertThat(jwt.getClaimAsString("email")).isEqualTo(email);
        assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofHours(1));
    }

    @Test
    void wrongPasswordAndUnknownEmailReturnIdentical401() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated());

        String wrongPasswordBody = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "wrong-password-123")))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        String unknownEmailBody = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(uniqueEmail(), "senha-forte-123")))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        // Same route, same generic ProblemDetail: nothing distinguishes the two causes.
        assertThat(wrongPasswordBody).isEqualTo(unknownEmailBody);
    }

    @Test
    void tamperedTokenIsRejectedWith401() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated());
        String loginBody = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "senha-forte-123")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(loginBody).get("accessToken").asText();
        String forged = token.substring(0, token.length() - 5) + "AAAAA";

        mockMvc.perform(get("/api/v1/orders")
                        .header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
    }
}
