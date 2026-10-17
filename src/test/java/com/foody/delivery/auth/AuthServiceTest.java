package com.foody.delivery.auth;

import com.foody.delivery.auth.dto.LoginRequest;
import com.foody.delivery.auth.dto.RegisterRequest;
import com.foody.delivery.auth.dto.RegisterResponse;
import com.foody.delivery.auth.dto.TokenResponse;
import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.shared.exception.UnauthorizedException;
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
        when(userRepository.existsByEmail(REQUEST.email())).thenReturn(false);
        when(passwordEncoder.encode(REQUEST.password())).thenReturn("$2a$10$irrelevant");
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(uniqueEmailViolation());

        assertThatThrownBy(() -> authService.register(REQUEST))
                .isInstanceOf(ConflictException.class)
                .hasMessage("An account with e-mail rodrigo@example.com already exists")
                .satisfies(e -> assertThat(((ConflictException) e).getTitle())
                        .isEqualTo("E-mail already registered"));
    }

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

    private static final LoginRequest LOGIN = new LoginRequest("rodrigo@example.com", "senha-forte-123");

    @Test
    void registerReturnsTheStoredIdNameAndEmail() {
        when(userRepository.existsByEmail("rodrigo@example.com")).thenReturn(false);
        when(passwordEncoder.encode("senha-forte-123")).thenReturn("$2a$10$hash");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);

        RegisterResponse response = authService.register(REQUEST);

        verify(userRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("$2a$10$hash");
        assertThat(response.id()).isEqualTo(saved.getValue().getId()).hasSize(36);
        assertThat(response.name()).isEqualTo("Rodrigo");
        assertThat(response.email()).isEqualTo("rodrigo@example.com");
    }

    @Test
    void loginIssuesTokenWhenPasswordMatches() {
        User user = User.register("Rodrigo", "rodrigo@example.com", "$2a$10$hash");
        TokenResponse token = new TokenResponse("t", "Bearer", 3600);
        when(userRepository.findByEmail("rodrigo@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("senha-forte-123", "$2a$10$hash")).thenReturn(true);
        when(tokenService.issue(user)).thenReturn(token);

        assertThat(authService.login(LOGIN)).isSameAs(token);
    }

    @Test
    void loginWithWrongPasswordIsUnauthorizedAndIssuesNoToken() {
        User user = User.register("Rodrigo", "rodrigo@example.com", "$2a$10$hash");
        when(userRepository.findByEmail("rodrigo@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("senha-forte-123", "$2a$10$hash")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(LOGIN))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid e-mail or password");
        verify(tokenService, never()).issue(any());
    }

    @Test
    void loginWithUnknownEmailStillRunsOneBcryptCheckAgainstTheDummyHash() {
        when(userRepository.findByEmail("rodrigo@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.matches("senha-forte-123", AuthService.DUMMY_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> authService.login(LOGIN))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid e-mail or password");
        verify(passwordEncoder).matches("senha-forte-123", AuthService.DUMMY_PASSWORD_HASH);
        verify(tokenService, never()).issue(any());
    }

    @Test
    void guessingTheDummyPlaintextNeverYieldsAToken() {
        when(userRepository.findByEmail("rodrigo@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.matches("senha-forte-123", AuthService.DUMMY_PASSWORD_HASH)).thenReturn(true);

        assertThatThrownBy(() -> authService.login(LOGIN)).isInstanceOf(UnauthorizedException.class);
        verify(tokenService, never()).issue(any());
    }
}
