package com.foody.delivery.shared.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The annotated {@link CharSequence} must not exceed {@code value} bytes once encoded
 * as UTF-8. This is NOT the same limit as {@link jakarta.validation.constraints.Size},
 * which counts Java characters: a 19-emoji password is 38 characters but 76 bytes.
 *
 * <p>It exists because BCrypt hard-caps a password at 72 <em>bytes</em> and
 * {@code BCryptPasswordEncoder.encode} throws {@code IllegalArgumentException} beyond
 * that. Expressing the limit as a bean-validation constraint makes the failure arrive
 * as a {@code MethodArgumentNotValidException}, so the client gets the usual 400
 * ProblemDetail naming the offending field instead of an unhandled 500.
 *
 * <p>Targets {@code FIELD} only: on a record component the annotation propagates to
 * the backing field, which is enough for validation and avoids the duplicate violation
 * that a field+getter pair would produce.
 */
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
