package com.foody.delivery.user;

import com.foody.delivery.TestDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataAccessException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.sqlite.SQLiteErrorCode;
import org.sqlite.SQLiteException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UserRepositoryTest {

    static final String JDBC_URL = TestDatabase.newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    @Autowired
    private UserRepository userRepository;

    @Test
    void findByEmailReturnsTheStoredUserOnExactMatchOnly() {
        User user = userRepository.save(User.register("Rodrigo", "rodrigo@example.com", "$2a$10$hash"));

        assertThat(userRepository.findByEmail("rodrigo@example.com"))
                .get().extracting(User::getId).isEqualTo(user.getId());
        assertThat(userRepository.findByEmail("RODRIGO@example.com")).isEmpty();
        assertThat(userRepository.findByEmail("nobody@example.com")).isEmpty();
    }

    @Test
    void existsByEmailMirrorsFindByEmail() {
        userRepository.save(User.register("Rodrigo", "rodrigo@example.com", "$2a$10$hash"));

        assertThat(userRepository.existsByEmail("rodrigo@example.com")).isTrue();
        assertThat(userRepository.existsByEmail("nobody@example.com")).isFalse();
    }

    @Test
    void createdAtRoundTripsThroughTheTextColumn() {
        User user = userRepository.saveAndFlush(User.register("Rodrigo", "ts@example.com", "$2a$10$hash"));

        assertThat(userRepository.findById(user.getId())).get()
                .extracting(User::getCreatedAt).isEqualTo(user.getCreatedAt());
    }

    @Test
    void duplicateEmailSurfacesAsASqliteUniqueConstraintViolation() {
        userRepository.saveAndFlush(User.register("Rodrigo", "dup@example.com", "$2a$10$hash"));

        assertThatThrownBy(() -> userRepository.saveAndFlush(User.register("Other", "dup@example.com", "$2a$10$hash")))
                .isInstanceOf(DataAccessException.class)
                .rootCause()
                .isInstanceOfSatisfying(SQLiteException.class, sqlite ->
                        assertThat(sqlite.getResultCode()).isEqualTo(SQLiteErrorCode.SQLITE_CONSTRAINT_UNIQUE));
    }
}
