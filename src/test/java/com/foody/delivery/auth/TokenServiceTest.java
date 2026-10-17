package com.foody.delivery.auth;

import com.foody.delivery.auth.dto.TokenResponse;
import com.foody.delivery.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TokenServiceTest {

    @Mock
    private JwtEncoder jwtEncoder;

    @InjectMocks
    private TokenService tokenService;

    private static Jwt encodedToken() {
        return Jwt.withTokenValue("signed-token")
                .header("alg", "RS256")
                .subject("user-1")
                .build();
    }

    @Test
    void issueReturnsBearerTokenWithOneHourExpiry() {
        when(jwtEncoder.encode(any(JwtEncoderParameters.class))).thenReturn(encodedToken());
        User user = User.register("Rodrigo", "rodrigo@example.com", "$2a$10$hash");

        TokenResponse response = tokenService.issue(user);

        assertThat(response.accessToken()).isEqualTo("signed-token");
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.expiresIn()).isEqualTo(3600L);
    }

    @Test
    void issuePutsUserIdAsSubjectAndEmailAsClaim() {
        when(jwtEncoder.encode(any(JwtEncoderParameters.class))).thenReturn(encodedToken());
        User user = User.register("Rodrigo", "rodrigo@example.com", "$2a$10$hash");
        ArgumentCaptor<JwtEncoderParameters> parameters = ArgumentCaptor.forClass(JwtEncoderParameters.class);

        tokenService.issue(user);

        verify(jwtEncoder).encode(parameters.capture());
        JwtClaimsSet claims = parameters.getValue().getClaims();
        assertThat(claims.getSubject()).isEqualTo(user.getId());
        assertThat(claims.<String>getClaim("email")).isEqualTo("rodrigo@example.com");
        assertThat(Duration.between(claims.getIssuedAt(), claims.getExpiresAt())).isEqualTo(Duration.ofHours(1));
        assertThat(claims.getIssuedAt()).isBetween(Instant.now().minusSeconds(5), Instant.now());
    }
}
