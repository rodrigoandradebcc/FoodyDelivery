package com.foody.delivery.auth;

import com.foody.delivery.auth.dto.LoginRequest;
import com.foody.delivery.auth.dto.RegisterRequest;
import com.foody.delivery.auth.dto.RegisterResponse;
import com.foody.delivery.auth.dto.TokenResponse;
import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.shared.exception.UnauthorizedException;
import com.foody.delivery.user.User;
import com.foody.delivery.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

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
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("E-mail already registered",
                    "An account with e-mail %s already exists".formatted(request.email()));
        }
        User user = User.register(request.name(), request.email(),
                passwordEncoder.encode(request.password()));
        userRepository.save(user);
        return new RegisterResponse(user.getId(), user.getName(), user.getEmail());
    }

    /**
     * Unknown e-mail and wrong password deliberately produce the SAME generic
     * 401, so the API never reveals which e-mails are registered.
     */
    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest request) {
        return userRepository.findByEmail(request.email())
                .filter(user -> passwordEncoder.matches(request.password(), user.getPasswordHash()))
                .map(tokenService::issue)
                .orElseThrow(() -> new UnauthorizedException("Invalid e-mail or password"));
    }
}
