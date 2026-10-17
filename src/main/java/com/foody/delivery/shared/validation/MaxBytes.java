package com.foody.delivery.shared.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = MaxBytesValidator.class)
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface MaxBytes {

    String message() default "must be at most {value} bytes long when encoded as UTF-8";

    int value();

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
