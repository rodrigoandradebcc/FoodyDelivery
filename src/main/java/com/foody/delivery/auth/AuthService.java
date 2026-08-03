package com.foody.delivery.auth;

import com.foody.delivery.auth.dto.LoginRequest;
import com.foody.delivery.auth.dto.RegisterRequest;
import com.foody.delivery.auth.dto.RegisterResponse;
import com.foody.delivery.auth.dto.TokenResponse;
import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.shared.exception.UnauthorizedException;
import com.foody.delivery.user.User;
import com.foody.delivery.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class AuthService {

    /**
     * A real BCrypt(10) hash of a fixed throwaway string, used ONLY to burn the same
     * ~100ms of CPU on the "e-mail not found" path as a genuine password check burns.
     * Without it, {@code Optional.filter} short-circuits and an unknown e-mail answers
     * three orders of magnitude faster than a wrong password — so response time alone
     * tells an attacker which e-mails are registered, which is exactly the enumeration
     * leak the identical-401 body is meant to close.
     *
     * <p>DO NOT delete this as dead weight and DO NOT skip the {@code matches} call when
     * the user is absent: the wasted work IS the feature. It is a hard-coded constant on
     * purpose — hashing it at runtime would move the cost to startup and reintroduce the
     * asymmetry here.
     */
    // Package-private so AuthFlowIntegrationTest can assert it is a well-formed BCrypt(10)
    // hash: a malformed constant would make matches() return false immediately, silently
    // restoring the timing leak this exists to close.
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

    /**
     * The {@code existsByEmail} pre-check and the {@code catch} are BOTH load-bearing, and they
     * are not redundant. The pre-check is what answers the common sequential case with a good
     * message; but on its own it is a check-then-insert with a race window — two concurrent
     * registrations of the same e-mail can both see {@code false}, and the second INSERT then
     * violates {@code UNIQUE(email)} (V1__create_users.sql) with a
     * {@code DataIntegrityViolationException}. {@code ApiExceptionHandler} deliberately has no
     * catch-all, so that used to escape as an HTTP 500. The database constraint always kept the
     * data correct — no duplicate account was ever created — it was only the status code that
     * degraded. Translating here makes the racing case answer with the same 409 as the
     * sequential one.
     *
     * <p>{@code saveAndFlush} rather than {@code save} is what makes the catch reachable: with a
     * plain {@code save} the entity is only queued in the persistence context and the INSERT is
     * issued at commit, i.e. AFTER this method has returned and outside the try block, so the
     * exception would never pass through it. Flushing pulls the constraint failure back inside.
     */
    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw emailAlreadyRegistered(request.email());
        }
        User user = User.register(request.name(), request.email(),
                passwordEncoder.encode(request.password()));
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw emailAlreadyRegistered(request.email());
        }
        return new RegisterResponse(user.getId(), user.getName(), user.getEmail());
    }

    private static ConflictException emailAlreadyRegistered(String email) {
        return new ConflictException("E-mail already registered",
                "An account with e-mail %s already exists".formatted(email));
    }

    /**
     * Unknown e-mail and wrong password deliberately produce the SAME generic
     * 401, so the API never reveals which e-mails are registered — same status, same
     * body, and (see {@link #DUMMY_PASSWORD_HASH}) the same amount of work, so the two
     * cases are indistinguishable by response time as well as by content.
     */
    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest request) {
        Optional<User> user = userRepository.findByEmail(request.email());
        // Exactly one BCrypt verification runs on every login, found or not. The result
        // is consumed by the guard below, so it cannot be optimised away.
        boolean passwordMatches = passwordEncoder.matches(request.password(),
                user.map(User::getPasswordHash).orElse(DUMMY_PASSWORD_HASH));
        // The isEmpty() check is load-bearing, not redundant: someone who guessed the
        // dummy plaintext would otherwise get a token for a non-existent account.
        if (user.isEmpty() || !passwordMatches) {
            throw new UnauthorizedException("Invalid e-mail or password");
        }
        return tokenService.issue(user.get());
    }
}
