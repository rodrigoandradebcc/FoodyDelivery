package com.foody.delivery.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

public class MaxBytesValidator implements ConstraintValidator<MaxBytes, CharSequence> {

    private int max;

    @Override
    public void initialize(MaxBytes constraint) {
        this.max = constraint.value();
    }

    @Override
    public boolean isValid(CharSequence value, ConstraintValidatorContext context) {
        // null is left to @NotNull/@NotBlank, per the bean-validation convention.
        return value == null || value.toString().getBytes(StandardCharsets.UTF_8).length <= max;
    }
}
