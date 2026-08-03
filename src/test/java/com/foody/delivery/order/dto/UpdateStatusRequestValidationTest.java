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
     * A missing status must be a 400, not a 409: without @NotNull it would reach
     * Order.changeStatus(null), where canTransitionTo(null) is simply false and the
     * client would be told the transition is invalid rather than that the field is.
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
