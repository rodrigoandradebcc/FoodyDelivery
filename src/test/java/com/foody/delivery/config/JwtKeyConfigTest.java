package com.foody.delivery.config;

import com.nimbusds.jose.jwk.RSAKey;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class JwtKeyConfigTest {

    @Test
    void encoderIssuesTokenThatDecoderAccepts() throws Exception {
        JwtKeyConfig config = new JwtKeyConfig();
        RSAKey rsaKey = config.rsaKey();
        JwtEncoder encoder = config.jwtEncoder(rsaKey);
        JwtDecoder decoder = config.jwtDecoder(rsaKey);

        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject("user-1")
                .claim("email", "rodrigo@example.com")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();

        Jwt jwt = decoder.decode(token);
        assertThat(jwt.getSubject()).isEqualTo("user-1");
        assertThat(jwt.getClaimAsString("email")).isEqualTo("rodrigo@example.com");
    }
}
