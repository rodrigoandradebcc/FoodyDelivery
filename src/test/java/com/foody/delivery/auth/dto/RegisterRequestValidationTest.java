package com.foody.delivery.auth.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RegisterRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static List<String> pathsOf(RegisterRequest request) {
        return validator.validate(request).stream()
                .map(violation -> violation.getPropertyPath().toString())
                .distinct()
                .sorted()
                .toList();
    }

    @Test
    void aWellFormedRequestHasNoViolations() {
        assertThat(pathsOf(new RegisterRequest("Rodrigo", "rodrigo@example.com", "senha-forte-123"))).isEmpty();
    }

    @Test
    void blankNameIsRejected() {
        assertThat(pathsOf(new RegisterRequest("   ", "rodrigo@example.com", "senha-forte-123")))
                .containsExactly("name");
    }

    @Test
    void nameOver120CharactersIsRejected() {
        assertThat(pathsOf(new RegisterRequest("x".repeat(121), "rodrigo@example.com", "senha-forte-123")))
                .containsExactly("name");
    }

    @Test
    void malformedEmailIsRejected() {
        assertThat(pathsOf(new RegisterRequest("Rodrigo", "not-an-email", "senha-forte-123")))
                .containsExactly("email");
    }

    @Test
    void passwordShorterThanEightCharactersIsRejected() {
        assertThat(pathsOf(new RegisterRequest("Rodrigo", "rodrigo@example.com", "1234567")))
                .containsExactly("password");
    }

    @Test
    void passwordOf72AsciiCharactersIsAccepted() {
        assertThat(pathsOf(new RegisterRequest("Rodrigo", "rodrigo@example.com", "a".repeat(72)))).isEmpty();
    }

    @Test
    void passwordOf73AsciiCharactersIsRejected() {
        assertThat(pathsOf(new RegisterRequest("Rodrigo", "rodrigo@example.com", "a".repeat(73))))
                .containsExactly("password");
    }

    @Test
    void passwordWithin72CharactersButOver72BytesIsRejected() {
        assertThat(pathsOf(new RegisterRequest("Rodrigo", "rodrigo@example.com", "🍕".repeat(19))))
                .containsExactly("password");
    }
}
