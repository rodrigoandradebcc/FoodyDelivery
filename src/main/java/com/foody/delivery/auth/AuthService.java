package com.foody.delivery.auth;

import com.foody.delivery.auth.dto.LoginRequest;
import com.foody.delivery.auth.dto.RegisterRequest;
import com.foody.delivery.auth.dto.RegisterResponse;
import com.foody.delivery.auth.dto.TokenResponse;
import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.shared.exception.UnauthorizedException;
import com.foody.delivery.user.User;
import com.foody.delivery.user.UserRepository;
import org.springframework.dao.DataAccessException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.sqlite.SQLiteErrorCode;
import org.sqlite.SQLiteException;

import java.util.Locale;
import java.util.Optional;

@Service
public class AuthService {

    static final String DUMMY_PASSWORD_HASH =
            "$2a$10$Ijm2Eog4JDcDiK8uGEVh9OqySxwHRtl6xUpnXSQD5PQP2FgCZLwHu";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       TokenService tokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw emailAlreadyRegistered(email);
        }
        User user = User.register(request.name(), email,
                passwordEncoder.encode(request.password()));
        try {
            userRepository.saveAndFlush(user);
        } catch (DataAccessException e) {
            if (isUniqueViolation(e)) {
                throw emailAlreadyRegistered(email);
            }
            throw e;
        }
        return new RegisterResponse(user.getId(), user.getName(), user.getEmail());
    }

    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean isUniqueViolation(Throwable e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLiteException sqlite
                    && sqlite.getResultCode() == SQLiteErrorCode.SQLITE_CONSTRAINT_UNIQUE) {
                return true;
            }
            if (cause.getCause() == cause) {
                return false;
            }
        }
        return false;
    }

    private static ConflictException emailAlreadyRegistered(String email) {
        return new ConflictException("E-mail already registered",
                "An account with e-mail %s already exists".formatted(email));
    }

    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest request) {
        Optional<User> user = userRepository.findByEmail(normalizeEmail(request.email()));
        boolean passwordMatches = passwordEncoder.matches(request.password(),
                user.map(User::getPasswordHash).orElse(DUMMY_PASSWORD_HASH));
        if (user.isEmpty() || !passwordMatches) {
            throw new UnauthorizedException("Invalid e-mail or password");
        }
        return tokenService.issue(user.get());
    }
}
