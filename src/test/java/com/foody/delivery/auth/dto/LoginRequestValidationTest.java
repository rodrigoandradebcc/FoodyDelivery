package com.foody.delivery.auth.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LoginRequestValidationTest {

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

    private static List<String> pathsOf(LoginRequest request) {
        return validator.validate(request).stream()
                .map(violation -> violation.getPropertyPath().toString())
                .distinct()
                .sorted()
                .toList();
    }

    @Test
    void aWellFormedRequestHasNoViolations() {
        assertThat(pathsOf(new LoginRequest("rodrigo@example.com", "senha-forte-123"))).isEmpty();
    }

    @Test
    void blankEmailAndPasswordAreRejected() {
        assertThat(pathsOf(new LoginRequest("", ""))).containsExactly("email", "password");
    }

    @Test
    void malformedEmailIsRejected() {
        assertThat(pathsOf(new LoginRequest("not-an-email", "senha-forte-123"))).containsExactly("email");
    }

    @Test
    void nullFieldsAreRejected() {
        assertThat(pathsOf(new LoginRequest(null, null))).containsExactly("email", "password");
    }
}
