package com.foody.delivery.config;

import com.nimbusds.jose.jwk.RSAKey;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtException;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    /**
     * The signature check is the security-load-bearing property of this config: the decoder
     * must be pinned to OUR public key, not merely "some" key. A token that is structurally
     * a perfectly valid RS256 JWT, but signed by an independent keypair, must be rejected.
     */
    @Test
    void decoderRejectsTokenSignedByAnotherKeypair() throws Exception {
        JwtKeyConfig config = new JwtKeyConfig();
        JwtDecoder decoder = config.jwtDecoder(config.rsaKey());

        JwtKeyConfig attacker = new JwtKeyConfig();
        JwtEncoder attackerEncoder = attacker.jwtEncoder(attacker.rsaKey());

        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject("user-1")
                .claim("email", "rodrigo@example.com")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .build();
        String foreignToken = attackerEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();

        assertThatThrownBy(() -> decoder.decode(foreignToken))
                .isInstanceOf(BadJwtException.class)
                .isInstanceOf(JwtException.class)
                // Pins the REASON for the rejection: the signature, not an expiry or a parse error.
                .hasMessageContaining("signature");
    }
}
