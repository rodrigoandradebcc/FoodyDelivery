package com.foody.delivery.shared.validation;

import com.foody.delivery.auth.dto.RegisterRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MaxBytesValidatorTest {

    private final MaxBytesValidator validator = new MaxBytesValidator();

    @BeforeEach
    void setUp() throws NoSuchFieldException {
        MaxBytes constraint = RegisterRequest.class.getDeclaredField("password").getAnnotation(MaxBytes.class);
        assertThat(constraint.value()).isEqualTo(72);
        validator.initialize(constraint);
    }

    @Test
    void nullIsValidAndLeftToNotNull() {
        assertThat(validator.isValid(null, null)).isTrue();
    }

    @Test
    void emptyStringIsValid() {
        assertThat(validator.isValid("", null)).isTrue();
    }

    @Test
    void exactly72AsciiBytesIsValid() {
        assertThat(validator.isValid("a".repeat(72), null)).isTrue();
        assertThat(validator.isValid("a".repeat(70) + "  ", null)).isTrue();
    }

    @Test
    void seventyThreeAsciiBytesIsInvalid() {
        assertThat(validator.isValid("a".repeat(73), null)).isFalse();
    }

    @Test
    void multibyteCharactersAreCountedAsUtf8Bytes() {
        assertThat(validator.isValid("🍕".repeat(18), null)).isTrue();
        assertThat(validator.isValid("🍕".repeat(19), null)).isFalse();
        assertThat(validator.isValid("ã".repeat(36), null)).isTrue();
        assertThat(validator.isValid("ã".repeat(37), null)).isFalse();
    }

    @Test
    void acceptsAnyCharSequence() {
        assertThat(validator.isValid(new StringBuilder("a".repeat(73)), null)).isFalse();
    }
}
