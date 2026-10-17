package com.foody.delivery.shared;

import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.shared.exception.NotFoundException;
import com.foody.delivery.shared.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DatabindException;
import tools.jackson.databind.exc.InvalidFormatException;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail handleNotFound(NotFoundException ex, HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, "Resource not found", ex.getMessage(), request);
    }

    @ExceptionHandler(ConflictException.class)
    ProblemDetail handleConflict(ConflictException ex, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, ex.getTitle(), ex.getMessage(), request);
    }

    @ExceptionHandler(UnauthorizedException.class)
    ProblemDetail handleUnauthorized(UnauthorizedException ex, HttpServletRequest request) {
        return problem(HttpStatus.UNAUTHORIZED, "Invalid credentials", ex.getMessage(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<Map<String, String>> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError(fieldError.getField(), String.valueOf(fieldError.getDefaultMessage())))
                .toList();
        return validationProblem(errors, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        DatabindException databind = databindCause(ex);
        if (databind != null && !databind.getPath().isEmpty()) {
            return validationProblem(List.of(fieldError(fieldPath(databind), describe(databind))), request);
        }
        return problem(HttpStatus.BAD_REQUEST, "Malformed request body",
                "Request body is missing or malformed", request);
    }

    private ProblemDetail validationProblem(List<Map<String, String>> errors, HttpServletRequest request) {
        ProblemDetail problem =
                problem(HttpStatus.BAD_REQUEST, "Validation failed", "One or more fields are invalid", request);
        problem.setProperty("errors", errors);
        return problem;
    }

    private static Map<String, String> fieldError(String field, String message) {
        return Map.of("field", field, "message", message);
    }

    private static DatabindException databindCause(Throwable ex) {
        for (Throwable cause = ex.getCause(); cause != null && cause != cause.getCause(); cause = cause.getCause()) {
            if (cause instanceof DatabindException databind) {
                return databind;
            }
        }
        return null;
    }

    private static String fieldPath(JacksonException ex) {
        StringBuilder path = new StringBuilder();
        for (JacksonException.Reference reference : ex.getPath()) {
            if (reference.getPropertyName() != null) {
                if (!path.isEmpty()) {
                    path.append('.');
                }
                path.append(reference.getPropertyName());
            } else if (reference.getIndex() >= 0) {
                path.append('[').append(reference.getIndex()).append(']');
            }
        }
        return path.toString();
    }

    private static String describe(DatabindException ex) {
        if (ex instanceof InvalidFormatException invalid) {
            Class<?> target = invalid.getTargetType();
            if (target != null && target.isEnum()) {
                return "must be one of " + Arrays.toString(target.getEnumConstants());
            }
            return "invalid value '%s'".formatted(invalid.getValue());
        }
        return "invalid value";
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setInstance(URI.create(request.getRequestURI()));
        return problem;
    }
}
