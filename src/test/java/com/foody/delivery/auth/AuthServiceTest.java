package com.foody.delivery.auth;

import com.foody.delivery.auth.dto.LoginRequest;
import com.foody.delivery.auth.dto.RegisterRequest;
import com.foody.delivery.auth.dto.RegisterResponse;
import com.foody.delivery.auth.dto.TokenResponse;
import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.user.User;
import com.foody.delivery.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.hibernate.exception.GenericJDBCException;
import org.springframework.dao.DataAccessException;
import org.springframework.orm.jpa.JpaSystemException;
import org.sqlite.SQLiteErrorCode;
import org.sqlite.SQLiteException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The concurrent half of duplicate registration, covered without a real race.
 *
 * <p>A test that actually spawned two threads racing on the same e-mail would be flaky and would
 * prove nothing repeatable: the losing INSERT only fails if the two transactions interleave, and
 * on a single-writer SQLite file they usually will not. What is worth pinning is narrower and
 * fully deterministic — that IF the unique constraint fires, {@code register} answers with the
 * same {@code ConflictException} the pre-check raises, not with the raw
 * {@code DataIntegrityViolationException} that {@code ApiExceptionHandler} (deliberately
 * catch-all-free) would let escape as an HTTP 500. Mocking the repository is what lets the
 * violation be injected on demand instead of waited for.
 *
 * <p>The sequential path is covered end-to-end by
 * {@code AuthFlowIntegrationTest.duplicateEmailReturns409ProblemDetail}.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private TokenService tokenService;

    @InjectMocks
    private AuthService authService;

    private static final RegisterRequest REQUEST =
            new RegisterRequest("Rodrigo", "rodrigo@example.com", "senha-forte-123");

    private static DataAccessException uniqueEmailViolation() {
        SQLiteException sqlite = new SQLiteException(
                "[SQLITE_CONSTRAINT_UNIQUE] A UNIQUE constraint failed (UNIQUE constraint failed: users.email)",
                SQLiteErrorCode.SQLITE_CONSTRAINT_UNIQUE);
        return new JpaSystemException(new GenericJDBCException("could not execute statement", sqlite,
                "insert into users (created_at,email,name,password_hash,id) values (?,?,?,?,?)"));
    }

    @Test
    void uniqueConstraintViolationBecomesTheSameConflictAsThePreCheck() {
        // The pre-check passes: this is the racing case, where the duplicate appeared between
        // the existsByEmail and the INSERT.
        when(userRepository.existsByEmail(REQUEST.email())).thenReturn(false);
        when(passwordEncoder.encode(REQUEST.password())).thenReturn("$2a$10$irrelevant");
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(uniqueEmailViolation());

        assertThatThrownBy(() -> authService.register(REQUEST))
                .isInstanceOf(ConflictException.class)
                .hasMessage("An account with e-mail rodrigo@example.com already exists")
                .satisfies(e -> assertThat(((ConflictException) e).getTitle())
                        .isEqualTo("E-mail already registered"));
    }

    /**
     * Pins that the two paths are indistinguishable to a client: same exception type, same title,
     * same detail. If either message ever drifts, the racing caller would get a different 409
     * body than the sequential one for the same cause.
     */
    @Test
    void racingAndSequentialDuplicatesProduceIdenticalConflicts() {
        when(userRepository.existsByEmail(REQUEST.email())).thenReturn(true);
        ConflictException sequential = catchThrowableOfType(ConflictException.class,
                () -> authService.register(REQUEST));

        when(userRepository.existsByEmail(REQUEST.email())).thenReturn(false);
        when(passwordEncoder.encode(REQUEST.password())).thenReturn("$2a$10$irrelevant");
        when(userRepository.saveAndFlush(any(User.class)))
                .thenThrow(uniqueEmailViolation());
        ConflictException racing = catchThrowableOfType(ConflictException.class,
                () -> authService.register(REQUEST));

        assertThat(racing.getTitle()).isEqualTo(sequential.getTitle());
        assertThat(racing.getMessage()).isEqualTo(sequential.getMessage());
    }

    /**
     * {@code save} would only queue the INSERT in the persistence context and issue it at commit,
     * i.e. after {@code register} has returned and outside its try block — the catch above would
     * then never see the violation and the 500 would be back, with every test still green because
     * no test can observe a flush that never happens. This verifies the flushing variant is the
     * one called.
     */
    @Test
    void registerFlushesSoTheConstraintViolationSurfacesInsideTheTryBlock() {
        when(userRepository.existsByEmail(REQUEST.email())).thenReturn(false);
        when(passwordEncoder.encode(REQUEST.password())).thenReturn("$2a$10$irrelevant");

        authService.register(REQUEST);

        verify(userRepository).saveAndFlush(any(User.class));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void unrelatedDatabaseFailuresAreNotDisguisedAsConflicts() {
        when(userRepository.existsByEmail(REQUEST.email())).thenReturn(false);
        when(passwordEncoder.encode(REQUEST.password())).thenReturn("$2a$10$irrelevant");
        JpaSystemException failure = new JpaSystemException(new RuntimeException("disk I/O error"));
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(failure);

        assertThatThrownBy(() -> authService.register(REQUEST)).isSameAs(failure);
    }

    @Test
    void registerNormalizesTheEmailBeforeCheckingAndStoring() {
        when(userRepository.existsByEmail("rodrigo@example.com")).thenReturn(false);
        when(passwordEncoder.encode("senha-forte-123")).thenReturn("$2a$10$hash");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);

        RegisterResponse response = authService.register(
                new RegisterRequest("Rodrigo", "  Rodrigo@Example.COM ", "senha-forte-123"));

        verify(userRepository).existsByEmail("rodrigo@example.com");
        verify(userRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getEmail()).isEqualTo("rodrigo@example.com");
        assertThat(response.email()).isEqualTo("rodrigo@example.com");
    }

    @Test
    void loginNormalizesTheEmailBeforeLookup() {
        User user = User.register("Rodrigo", "rodrigo@example.com", "$2a$10$hash");
        when(userRepository.findByEmail("rodrigo@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("senha-forte-123", "$2a$10$hash")).thenReturn(true);
        when(tokenService.issue(user)).thenReturn(new TokenResponse("t", "Bearer", 3600));

        authService.login(new LoginRequest(" Rodrigo@Example.com", "senha-forte-123"));

        verify(userRepository).findByEmail("rodrigo@example.com");
    }
}
