package com.foody.delivery.auth;

import com.foody.delivery.auth.dto.LoginRequest;
import com.foody.delivery.auth.dto.RegisterRequest;
import com.foody.delivery.auth.dto.RegisterResponse;
import com.foody.delivery.auth.dto.TokenResponse;
import com.foody.delivery.config.SecurityConfig;
import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.shared.exception.UnauthorizedException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItems;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    private static final String REGISTER_JSON = """
            {"name": "Rodrigo", "email": "rodrigo@example.com", "password": "senha-forte-123"}
            """;

    private static final String LOGIN_JSON = """
            {"email": "rodrigo@example.com", "password": "senha-forte-123"}
            """;

    @Test
    void registerIsPublicAndReturns201WithTheServiceResponse() throws Exception {
        when(authService.register(new RegisterRequest("Rodrigo", "rodrigo@example.com", "senha-forte-123")))
                .thenReturn(new RegisterResponse("user-1", "Rodrigo", "rodrigo@example.com"));

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(REGISTER_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("user-1"))
                .andExpect(jsonPath("$.name").value("Rodrigo"))
                .andExpect(jsonPath("$.email").value("rodrigo@example.com"));
    }

    @Test
    void registerRejectsInvalidPayloadBeforeReachingTheService() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "", "email": "not-an-email", "password": "123"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[*].field", hasItems("name", "email", "password")));
        verify(authService, never()).register(any());
    }

    @Test
    void registerConflictBecomes409ProblemDetail() throws Exception {
        when(authService.register(any())).thenThrow(
                new ConflictException("E-mail already registered", "An account with e-mail rodrigo@example.com already exists"));

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(REGISTER_JSON))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("E-mail already registered"))
                .andExpect(jsonPath("$.detail").value("An account with e-mail rodrigo@example.com already exists"))
                .andExpect(jsonPath("$.instance").value("/api/v1/auth/register"));
    }

    @Test
    void loginReturns200WithTheToken() throws Exception {
        when(authService.login(new LoginRequest("rodrigo@example.com", "senha-forte-123")))
                .thenReturn(new TokenResponse("token-123", "Bearer", 3600));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LOGIN_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("token-123"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(3600));
    }

    @Test
    void loginFailureBecomes401ProblemDetail() throws Exception {
        when(authService.login(any())).thenThrow(new UnauthorizedException("Invalid e-mail or password"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LOGIN_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Invalid credentials"))
                .andExpect(jsonPath("$.detail").value("Invalid e-mail or password"));
    }

    @Test
    void loginWithBlankFieldsIs400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "", "password": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItems("email", "password")));
        verify(authService, never()).login(any());
    }

    @Test
    void malformedJsonIs400ProblemDetail() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Malformed request body"));
    }
}
