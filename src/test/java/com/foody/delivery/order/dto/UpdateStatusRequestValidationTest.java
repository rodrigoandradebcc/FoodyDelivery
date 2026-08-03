package com.foody.delivery.order.dto;

import com.foody.delivery.order.OrderStatus;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UpdateStatusRequestValidationTest {

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

    /**
     * A missing status must be a 400, and @NotNull is the only thing that makes it one:
     * without it the null would reach Order.changeStatus(null). OrderStatus.canTransitionTo
     * now null-guards and answers false, so the client would at best be told the transition
     * is invalid (a 409) rather than that the field is missing — and before that guard existed
     * it was worse still: Set.of(...).contains(null) throws NullPointerException, so the
     * request came back as an unhandled HTTP 500 with no ProblemDetail body. See
     * OrderStatusTest.nullTargetIsNeverAllowed, which pins the guard.
     */
    @Test
    void missingStatusIsRejected() {
        assertThat(validator.validate(new UpdateStatusRequest(null)))
                .singleElement()
                .satisfies(violation ->
                        assertThat(violation.getPropertyPath()).hasToString("status"));
    }

    @Test
    void aKnownStatusIsAccepted() {
        assertThat(validator.validate(new UpdateStatusRequest(OrderStatus.EM_PREPARO))).isEmpty();
    }
}
