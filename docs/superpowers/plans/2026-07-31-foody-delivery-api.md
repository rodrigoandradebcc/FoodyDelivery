# FoodyDelivery REST API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FoodyDelivery REST API — user registration/login with self-issued JWT and authenticated order management (create, list, get, status transitions) on SQLite — exactly as specified in `docs/superpowers/specs/2026-07-31-foody-delivery-api-design.md`.

**Architecture:** Package-by-feature Spring Boot 4 monolith (`auth`, `user`, `order`, `config`, `shared`). Schema owned by Flyway (SQLite), Hibernate runs with `ddl-auto: validate`. Status transitions live in the `OrderStatus` enum, enforced by the `Order` domain entity; a `@RestControllerAdvice` maps domain exceptions to RFC 7807 `ProblemDetail`.

**Tech Stack:** Java 21, Spring Boot 4.1.0 (Maven), SQLite (`org.xerial:sqlite-jdbc`) + `hibernate-community-dialects`, Flyway (`flyway-core` + `flyway-database-nc-sqlite`), Spring Security 7 resource server with in-memory RSA JWT, springdoc-openapi 3.0.3, JUnit 5 + Mockito + MockMvc.

## Verified dependency facts (checked against Maven Central + Spring Boot docs on 2026-07-31)

These were confirmed by fetching `repo1.maven.org` metadata/POMs and Spring Boot 4.0.3/4.1.0 documentation (Context7). Do not "fix" them from memory:

1. `org.springframework.boot:spring-boot-starter-parent:4.1.0` is the latest GA release. Its BOM manages: **Flyway 12.4.0**, **Hibernate 7.4.1.Final** (module list includes `org.hibernate.orm:hibernate-community-dialects`), **sqlite-jdbc 3.53.2.0** (property `sqlite-jdbc.version`). So `sqlite-jdbc`, `hibernate-community-dialects`, and `flyway-core` need **no version tags**.
2. `org.flywaydb:flyway-database-nc-sqlite` exists on Maven Central only for **Flyway ≥ 12.3.0** (12.3.0 … 13.1.0; `12.4.0` POM verified HTTP 200). It is **NOT in the Spring Boot BOM's managed module list**, so it MUST carry an explicit version — use `${flyway.version}` so it always matches `flyway-core`. This is also why the parent must be **4.1.0, not 4.0.x**: Boot 4.0.3 manages Flyway **11.14.1**, for which `flyway-database-nc-sqlite` does not exist.
3. Spring Boot 4 renamed starters. All of these exist at 4.1.0 (verified HTTP 200 on Central): `spring-boot-starter-webmvc` (replaces deprecated `spring-boot-starter-web`), `spring-boot-starter-security-oauth2-resource-server` (replaces deprecated `spring-boot-starter-oauth2-resource-server`), `spring-boot-starter-flyway`, `spring-boot-starter-test`, `spring-boot-starter-webmvc-test`, `spring-boot-starter-data-jpa`, `spring-boot-starter-validation`, `spring-boot-starter-security`.
4. In Boot 4, Flyway auto-configuration lives in the `spring-boot-flyway` module. Adding bare `flyway-core` does NOT run migrations at startup — `spring-boot-starter-flyway` must be on the classpath (it is in the pom below).
5. In Boot 4, `@AutoConfigureMockMvc` moved to package **`org.springframework.boot.webmvc.test.autoconfigure`** (module `spring-boot-webmvc-test`) — confirmed in Boot 4.0.3 docs. `MockMvc` itself is unchanged: `org.springframework.test.web.servlet.MockMvc`.
6. `org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.3` is the latest release and its POM references Boot 4 modules (`spring-boot-starter-webmvc-test`, `spring-boot-tomcat`), i.e. it targets Spring Boot 4.

## Global Constraints

Copied from the approved spec — every task implicitly includes these:

- Java 21, Spring Boot 4.x, Maven (wrapper committed; run via `./mvnw`).
- SQLite persistence: `org.xerial:sqlite-jdbc` + `org.hibernate.orm:hibernate-community-dialects`, dialect `org.hibernate.community.dialect.SQLiteDialect`.
- Flyway: `flyway-core` + `flyway-database-nc-sqlite`; `spring.jpa.hibernate.ddl-auto: validate` (schema comes ONLY from Flyway). Migrations always additive.
- Datasource URL exactly: `jdbc:sqlite:./data/foody.db?journal_mode=WAL&busy_timeout=5000` (WAL + busy_timeout are the SQLite write-concurrency mitigations — never remove).
- Money is `long` cents everywhere (`unit_price_cents`, `total_cents`). NEVER `double`/`float`/`BigDecimal` for money — in Java or in SQL.
- IDs are UUID stored as 36-char TEXT. Timestamps are `java.time.Instant` stored as ISO-8601 text.
- `total_cents` always computed server-side from items; never accepted from the client. Orders are born `RECEBIDO` with ≥1 item; `quantity >= 1`; `unit_price_cents >= 0`.
- State machine (in the `OrderStatus` enum via `Set<OrderStatus> allowedNext` + `canTransitionTo`, enforced in the domain, NOT the controller): `RECEBIDO → {EM_PREPARO, CANCELADO}`, `EM_PREPARO → {SAIU_PARA_ENTREGA, CANCELADO}`, `SAIU_PARA_ENTREGA → {ENTREGUE}`, `ENTREGUE`/`CANCELADO` terminal. Invalid transition → HTTP 409.
- JWT via oauth2 resource server; RSA keypair generated in memory at boot (`NimbusJwtEncoder`/`NimbusJwtDecoder`); no committed keys; claims `sub` = user id, `email`, `exp` = 1 hour. BCrypt strength 10. `SessionCreationPolicy.STATELESS`; CSRF disabled.
- Public routes: `/api/v1/auth/**`, `/swagger-ui/**`, `/v3/api-docs/**`. Everything else authenticated. No roles — any authenticated user sees all orders.
- Login with unknown e-mail and login with wrong password return the SAME generic 401.
- Errors are RFC 7807 `ProblemDetail` from a single `@RestControllerAdvice`; 400 validation errors carry an `errors` extension field.
- Package-by-feature layout per spec section 7. No `interface` + `Impl` pairs for single implementations.
- Tests: JUnit 5 + Mockito unit tests; `@SpringBootTest` + MockMvc integration tests against a **temp-FILE** SQLite DB per test class (`${java.io.tmpdir}/foody-test-<random>.db`), NEVER `:memory:`. Flyway runs in tests the same as in prod.
- Password hash never appears in logs or response DTOs.
- API base path `/api/v1`.

## File structure (final state)

```
FoodyDelivery/
├─ pom.xml · mvnw · mvnw.cmd · .mvn/ · .gitignore · README.md
├─ data/.gitkeep                              # runtime SQLite dir (db files gitignored)
├─ docs/superpowers/...                       # spec + this plan (already present)
├─ src/main/resources/
│  ├─ application.yml
│  └─ db/migration/V1__create_users.sql · V2__create_orders_and_items.sql
├─ src/main/java/com/foody/delivery/
│  ├─ FoodyDeliveryApplication.java
│  ├─ config/ SecurityConfig.java · JwtKeyConfig.java · OpenApiConfig.java
│  ├─ shared/ ApiExceptionHandler.java · InstantStringConverter.java
│  │  └─ exception/ NotFoundException.java · ConflictException.java · UnauthorizedException.java
│  ├─ auth/ AuthController.java · AuthService.java · TokenService.java
│  │  └─ dto/ RegisterRequest · RegisterResponse · LoginRequest · TokenResponse
│  ├─ user/ User.java · UserRepository.java
│  └─ order/ OrderController.java · OrderService.java · OrderRepository.java
│     · Order.java · OrderItem.java · Address.java · OrderStatus.java · OrderMapper.java
│     └─ dto/ CreateOrderRequest · OrderItemRequest · AddressDto · UpdateStatusRequest
│        · OrderResponse · OrderItemResponse · PageResponse
└─ src/test/java/com/foody/delivery/
   ├─ AbstractIntegrationTest.java
   ├─ config/ JwtKeyConfigTest.java · SecurityIntegrationTest.java
   ├─ auth/ AuthFlowIntegrationTest.java
   └─ order/ OrderStatusTest.java · OrderServiceTest.java
      · PersistenceIntegrationTest.java · OrderFlowIntegrationTest.java · SwaggerIntegrationTest.java
```

Working directory for every command: `/Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery`.

---

### Task 1: Project scaffolding (git, Maven wrapper, pom, config, main class)

**Files:**
- Create: `/Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery/.gitignore`
- Create: `mvnw`, `mvnw.cmd`, `.mvn/wrapper/*` (copied from a Spring Initializr download)
- Create: `/Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery/pom.xml`
- Create: `/Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery/src/main/resources/application.yml`
- Create: `/Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery/src/main/java/com/foody/delivery/FoodyDeliveryApplication.java`
- Create: `/Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery/data/.gitkeep`

**Interfaces:**
- Consumes: nothing (greenfield).
- Produces: a compiling Maven project every later task builds on; base package `com.foody.delivery`; the exact dependency set (later tasks add NO dependencies).

- [ ] **Step 1: Init git and fetch the Maven wrapper via Spring Initializr**

```bash
cd /Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery
git init
SCRATCH=$(mktemp -d)
curl -fsSL https://start.spring.io/starter.tgz \
  -d type=maven-project -d language=java -d bootVersion=4.1.0 -d javaVersion=21 \
  -d groupId=com.foody -d artifactId=foody-delivery -d name=foody-delivery \
  -d packageName=com.foody.delivery -o "$SCRATCH/starter.tgz"
tar -xzf "$SCRATCH/starter.tgz" -C "$SCRATCH"
cp -R "$SCRATCH/.mvn" .
cp "$SCRATCH/mvnw" "$SCRATCH/mvnw.cmd" .
chmod +x mvnw
```

Only the wrapper files are kept — `pom.xml` and sources are written by hand below. Fallbacks if the curl fails: (a) Initializr rejects `bootVersion=4.1.0` → retry the same command without the `-d bootVersion=...` argument (any recent version's wrapper is fine, the wrapper is Boot-version-agnostic); (b) no network → run `mvn -N wrapper:wrapper` if a system Maven exists.

- [ ] **Step 2: Verify the wrapper and JDK**

Run: `./mvnw -v`
Expected: prints `Apache Maven 3.9.x` and a Java version ≥ 21. If Java is < 21, stop and report — a JDK 21+ must be on `JAVA_HOME` before continuing.

- [ ] **Step 3: Write `.gitignore`**

```gitignore
target/
data/*.db
data/*.db-shm
data/*.db-wal
.idea/
*.iml
.vscode/
.DS_Store
```

- [ ] **Step 4: Write `pom.xml`**

Exact content (version rationale in "Verified dependency facts" above — do not add versions to managed artifacts, do not remove `${flyway.version}` from `flyway-database-nc-sqlite`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.1.0</version>
    <relativePath/>
  </parent>

  <groupId>com.foody</groupId>
  <artifactId>foody-delivery</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>foody-delivery</name>
  <description>FoodyDelivery REST API</description>

  <properties>
    <java.version>21</java.version>
    <springdoc.version>3.0.3</springdoc.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-webmvc</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security-oauth2-resource-server</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-flyway</artifactId>
    </dependency>

    <dependency>
      <groupId>org.xerial</groupId>
      <artifactId>sqlite-jdbc</artifactId>
    </dependency>
    <dependency>
      <groupId>org.hibernate.orm</groupId>
      <artifactId>hibernate-community-dialects</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-database-nc-sqlite</artifactId>
      <version>${flyway.version}</version>
    </dependency>

    <dependency>
      <groupId>org.springdoc</groupId>
      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
      <version>${springdoc.version}</version>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-webmvc-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 5: Write `src/main/resources/application.yml`**

The datasource block is verbatim from the spec (WAL + busy_timeout are mandatory SQLite mitigations):

```yaml
spring:
  application:
    name: foody-delivery
  datasource:
    url: jdbc:sqlite:./data/foody.db?journal_mode=WAL&busy_timeout=5000
    driver-class-name: org.sqlite.JDBC
  jpa:
    database-platform: org.hibernate.community.dialect.SQLiteDialect
    hibernate:
      ddl-auto: validate     # schema comes from Flyway
    open-in-view: false
```

- [ ] **Step 6: Write the main class and the runtime data dir**

`src/main/java/com/foody/delivery/FoodyDeliveryApplication.java`:

```java
package com.foody.delivery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class FoodyDeliveryApplication {

    public static void main(String[] args) {
        SpringApplication.run(FoodyDeliveryApplication.class, args);
    }
}
```

Create the empty file `data/.gitkeep` (sqlite-jdbc creates the `.db` file but NOT its parent directory, so `data/` must exist in the repo).

- [ ] **Step 7: Verify compile**

Run: `./mvnw clean compile`
Expected: `BUILD SUCCESS` (downloads dependencies on first run; in particular `flyway-database-nc-sqlite-12.4.0.jar` must resolve — if it does not, the parent version drifted from 4.1.0).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Spring Boot 4.1 project with SQLite/Flyway/JWT dependency set"
```

---

### Task 2: Shared error model (domain exceptions, ProblemDetail advice, Instant converter)

**Files:**
- Create: `src/main/java/com/foody/delivery/shared/exception/NotFoundException.java`
- Create: `src/main/java/com/foody/delivery/shared/exception/ConflictException.java`
- Create: `src/main/java/com/foody/delivery/shared/exception/UnauthorizedException.java`
- Create: `src/main/java/com/foody/delivery/shared/InstantStringConverter.java`
- Create: `src/main/java/com/foody/delivery/shared/ApiExceptionHandler.java`

**Interfaces:**
- Consumes: Task 1 project skeleton.
- Produces (used by every later task):
  - `NotFoundException(String detail)` → 404
  - `ConflictException(String title, String detail)` with `String getTitle()` → 409
  - `UnauthorizedException(String detail)` → 401
  - `InstantStringConverter` — JPA `@Converter(autoApply = true)` mapping `Instant ↔ String` (ISO-8601), so all `Instant` entity fields persist as TEXT.
  - Handler behavior: `MethodArgumentNotValidException` → 400 with `errors` extension array of `{field, message}`; `HttpMessageNotReadableException` → 400; all responses are `ProblemDetail` with `title`, `detail`, `instance` = request URI.

- [ ] **Step 1: Write the three exceptions**

`shared/exception/NotFoundException.java`:

```java
package com.foody.delivery.shared.exception;

public class NotFoundException extends RuntimeException {

    public NotFoundException(String detail) {
        super(detail);
    }
}
```

`shared/exception/ConflictException.java`:

```java
package com.foody.delivery.shared.exception;

public class ConflictException extends RuntimeException {

    private final String title;

    public ConflictException(String title, String detail) {
        super(detail);
        this.title = title;
    }

    public String getTitle() {
        return title;
    }
}
```

`shared/exception/UnauthorizedException.java`:

```java
package com.foody.delivery.shared.exception;

public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String detail) {
        super(detail);
    }
}
```

- [ ] **Step 2: Write the Instant converter**

`shared/InstantStringConverter.java` — this is what guarantees "Instant stored as ISO-8601 TEXT" (`Instant.toString()` is ISO-8601 UTC; `Instant.parse` is its exact inverse):

```java
package com.foody.delivery.shared;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.time.Instant;

/**
 * SQLite has no native TIMESTAMP type. Persist every Instant as an ISO-8601
 * string (TEXT column) so values are human-readable and sort chronologically.
 */
@Converter(autoApply = true)
public class InstantStringConverter implements AttributeConverter<Instant, String> {

    @Override
    public String convertToDatabaseColumn(Instant attribute) {
        return attribute == null ? null : attribute.toString();
    }

    @Override
    public Instant convertToEntityAttribute(String dbData) {
        return dbData == null ? null : Instant.parse(dbData);
    }
}
```

- [ ] **Step 3: Write the advice**

`shared/ApiExceptionHandler.java`:

```java
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

import java.net.URI;
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
        ProblemDetail problem =
                problem(HttpStatus.BAD_REQUEST, "Validation failed", "One or more fields are invalid", request);
        List<Map<String, String>> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> Map.of(
                        "field", fieldError.getField(),
                        "message", String.valueOf(fieldError.getDefaultMessage())))
                .toList();
        problem.setProperty("errors", errors);
        return problem;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "Malformed request body",
                "Request body is missing or malformed", request);
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setInstance(URI.create(request.getRequestURI()));
        return problem;
    }
}
```

- [ ] **Step 4: Verify compile**

Run: `./mvnw clean compile`
Expected: `BUILD SUCCESS`. (Behavior is exercised by the integration tests in Tasks 6 and 8.)

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/foody/delivery/shared
git commit -m "feat: shared domain exceptions, ProblemDetail advice and Instant<->TEXT converter"
```

---

### Task 3: OrderStatus state machine (TDD, full 5×5 matrix)

**Files:**
- Create: `src/test/java/com/foody/delivery/order/OrderStatusTest.java`
- Create: `src/main/java/com/foody/delivery/order/OrderStatus.java`

**Interfaces:**
- Consumes: Task 1 skeleton only.
- Produces: `enum OrderStatus { RECEBIDO, EM_PREPARO, SAIU_PARA_ENTREGA, ENTREGUE, CANCELADO }` with `boolean canTransitionTo(OrderStatus next)`. Used by `Order` (Task 4), `OrderService` (Task 7), DTOs/controller (Tasks 7–8).

- [ ] **Step 1: Write the failing test — all 25 combinations**

`src/test/java/com/foody/delivery/order/OrderStatusTest.java`:

```java
package com.foody.delivery.order;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class OrderStatusTest {

    @ParameterizedTest(name = "{0} -> {1} should be {2}")
    @CsvSource({
            // from,              to,                 allowed
            "RECEBIDO,           RECEBIDO,           false",
            "RECEBIDO,           EM_PREPARO,         true",
            "RECEBIDO,           SAIU_PARA_ENTREGA,  false",
            "RECEBIDO,           ENTREGUE,           false",
            "RECEBIDO,           CANCELADO,          true",
            "EM_PREPARO,         RECEBIDO,           false",
            "EM_PREPARO,         EM_PREPARO,         false",
            "EM_PREPARO,         SAIU_PARA_ENTREGA,  true",
            "EM_PREPARO,         ENTREGUE,           false",
            "EM_PREPARO,         CANCELADO,          true",
            "SAIU_PARA_ENTREGA,  RECEBIDO,           false",
            "SAIU_PARA_ENTREGA,  EM_PREPARO,         false",
            "SAIU_PARA_ENTREGA,  SAIU_PARA_ENTREGA,  false",
            "SAIU_PARA_ENTREGA,  ENTREGUE,           true",
            "SAIU_PARA_ENTREGA,  CANCELADO,          false",
            "ENTREGUE,           RECEBIDO,           false",
            "ENTREGUE,           EM_PREPARO,         false",
            "ENTREGUE,           SAIU_PARA_ENTREGA,  false",
            "ENTREGUE,           ENTREGUE,           false",
            "ENTREGUE,           CANCELADO,          false",
            "CANCELADO,          RECEBIDO,           false",
            "CANCELADO,          EM_PREPARO,         false",
            "CANCELADO,          SAIU_PARA_ENTREGA,  false",
            "CANCELADO,          ENTREGUE,           false",
            "CANCELADO,          CANCELADO,          false"
    })
    void transitionMatrix(OrderStatus from, OrderStatus to, boolean allowed) {
        assertThat(from.canTransitionTo(to)).isEqualTo(allowed);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./mvnw test -Dtest=OrderStatusTest`
Expected: COMPILATION ERROR — `OrderStatus` does not exist yet.

- [ ] **Step 3: Implement the enum**

`src/main/java/com/foody/delivery/order/OrderStatus.java`:

```java
package com.foody.delivery.order;

import java.util.Set;

/**
 * Order state machine. The transition rule lives HERE, not in controllers.
 * Documented decision: after SAIU_PARA_ENTREGA an order can no longer be cancelled.
 */
public enum OrderStatus {

    RECEBIDO,
    EM_PREPARO,
    SAIU_PARA_ENTREGA,
    ENTREGUE,
    CANCELADO;

    private Set<OrderStatus> allowedNext = Set.of();

    static {
        RECEBIDO.allowedNext = Set.of(EM_PREPARO, CANCELADO);
        EM_PREPARO.allowedNext = Set.of(SAIU_PARA_ENTREGA, CANCELADO);
        SAIU_PARA_ENTREGA.allowedNext = Set.of(ENTREGUE);
        // ENTREGUE and CANCELADO are terminal: empty set.
    }

    public boolean canTransitionTo(OrderStatus next) {
        return allowedNext.contains(next);
    }
}
```

(The `static` block is required because enum constructors cannot reference constants that are not yet defined.)

- [ ] **Step 4: Run to verify it passes**

Run: `./mvnw test -Dtest=OrderStatusTest`
Expected: `Tests run: 25, Failures: 0` — BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/foody/delivery/order/OrderStatus.java src/test/java/com/foody/delivery/order/OrderStatusTest.java
git commit -m "feat: OrderStatus state machine with full 5x5 transition matrix test"
```

---

### Task 4: Flyway migrations + entities + repositories + schema-validation round-trip test

This is the highest-risk checkpoint: Flyway-on-SQLite DDL must satisfy Hibernate's `ddl-auto: validate` against the entity mappings.

**Type-name rule for the SQL below (do not "simplify" it):** SQLite gives every column a type *affinity* derived from the declared name — `varchar(36)` gets TEXT affinity, `bigint`/`integer` get INTEGER affinity — so declaring `varchar`/`bigint` stores exactly the TEXT/INTEGER storage classes the spec requires. We declare `varchar`/`bigint`/`integer` (instead of the literal words `TEXT`/`INTEGER`) because Hibernate's validator compares JDBC type codes reported by sqlite-jdbc from the *declared* name against the mapped Java types (`String`→VARCHAR, `long`→BIGINT, `int`→INTEGER); literal `TEXT` on a `long` column or `INTEGER` on a `bigint` mapping can fail validation. **Fallback if `validate` still fails** (error `SchemaManagementException: wrong column type ... found [X], but expecting [Y]`): change that column's declared type name in the migration to the reported expected name `Y` — never change `ddl-auto` away from `validate`, never change the Java types.

**Files:**
- Create: `src/main/resources/db/migration/V1__create_users.sql`
- Create: `src/main/resources/db/migration/V2__create_orders_and_items.sql`
- Create: `src/main/java/com/foody/delivery/user/User.java`
- Create: `src/main/java/com/foody/delivery/user/UserRepository.java`
- Create: `src/main/java/com/foody/delivery/order/Address.java`
- Create: `src/main/java/com/foody/delivery/order/OrderItem.java`
- Create: `src/main/java/com/foody/delivery/order/Order.java`
- Create: `src/main/java/com/foody/delivery/order/OrderRepository.java`
- Create: `src/test/java/com/foody/delivery/AbstractIntegrationTest.java`
- Create: `src/test/java/com/foody/delivery/order/PersistenceIntegrationTest.java`

**Interfaces:**
- Consumes: `OrderStatus` (Task 3), `ConflictException` + `InstantStringConverter` (Task 2).
- Produces (exact signatures later tasks call):
  - `User.register(String name, String email, String passwordHash)` static factory; getters `getId()`, `getName()`, `getEmail()`, `getPasswordHash()`, `getCreatedAt()`.
  - `UserRepository extends JpaRepository<User, String>` with `Optional<User> findByEmail(String email)` and `boolean existsByEmail(String email)`.
  - `new Address(String street, String number, String complement, String district, String city, String state, String zipCode)` + getters.
  - `new OrderItem(String productName, long unitPriceCents, int quantity)` + getters + `long subtotalCents()`.
  - `Order.place(String userId, List<OrderItem> items, Address deliveryAddress)` static factory (computes `totalCents`, starts `RECEBIDO`); `void changeStatus(OrderStatus next)` (throws `ConflictException("Invalid status transition", ...)`); getters `getId()`, `getUserId()`, `getStatus()`, `getTotalCents()`, `getItems()`, `getDeliveryAddress()`, `getCreatedAt()`, `getUpdatedAt()`.
  - `OrderRepository extends JpaRepository<Order, String>` with `Page<Order> findByStatus(OrderStatus status, Pageable pageable)`.
  - `AbstractIntegrationTest` — `@SpringBootTest @AutoConfigureMockMvc` base with `protected MockMvc mockMvc`, `protected ObjectMapper objectMapper`, and `protected static String newTempSqliteUrl()`. Every integration test class extends it and declares its OWN `@DynamicPropertySource` (one temp DB file per test class, per spec).

- [ ] **Step 1: Write migration V1**

`src/main/resources/db/migration/V1__create_users.sql`:

```sql
-- SQLite: varchar(...) columns get TEXT affinity (= TEXT storage class).
-- Timestamps are ISO-8601 text. IDs are 36-char UUID text.
CREATE TABLE users (
    id            varchar(36)  NOT NULL PRIMARY KEY,
    name          varchar(120) NOT NULL,
    email         varchar(180) NOT NULL UNIQUE,
    password_hash varchar(60)  NOT NULL,
    created_at    varchar(35)  NOT NULL
);
```

- [ ] **Step 2: Write migration V2**

`src/main/resources/db/migration/V2__create_orders_and_items.sql`:

```sql
-- Money columns are bigint (INTEGER affinity) holding cents. Never REAL.
CREATE TABLE orders (
    id          varchar(36)  NOT NULL PRIMARY KEY,
    user_id     varchar(36)  NOT NULL REFERENCES users (id),
    status      varchar(30)  NOT NULL,
    total_cents bigint       NOT NULL,
    street      varchar(150) NOT NULL,
    number      varchar(20)  NOT NULL,
    complement  varchar(150),
    district    varchar(100) NOT NULL,
    city        varchar(100) NOT NULL,
    state       varchar(2)   NOT NULL,
    zip_code    varchar(8)   NOT NULL,
    created_at  varchar(35)  NOT NULL,
    updated_at  varchar(35)  NOT NULL
);

CREATE INDEX idx_orders_status ON orders (status);

CREATE TABLE order_items (
    id               varchar(36)  NOT NULL PRIMARY KEY,
    order_id         varchar(36)  NOT NULL REFERENCES orders (id),
    product_name     varchar(150) NOT NULL,
    unit_price_cents bigint       NOT NULL,
    quantity         integer      NOT NULL
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
```

- [ ] **Step 3: Write the User entity and repository**

`src/main/java/com/foody/delivery/user/User.java`:

```java
package com.foody.delivery.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, unique = true, length = 180)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 60)
    private String passwordHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected User() {
        // JPA
    }

    public static User register(String name, String email, String passwordHash) {
        User user = new User();
        user.id = UUID.randomUUID().toString();
        user.name = name;
        user.email = email;
        user.passwordHash = passwordHash;
        user.createdAt = Instant.now();
        return user;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
```

`src/main/java/com/foody/delivery/user/UserRepository.java`:

```java
package com.foody.delivery.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);
}
```

- [ ] **Step 4: Write Address, OrderItem, Order, OrderRepository**

`src/main/java/com/foody/delivery/order/Address.java`:

```java
package com.foody.delivery.order;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class Address {

    @Column(nullable = false, length = 150)
    private String street;

    @Column(nullable = false, length = 20)
    private String number;

    @Column(length = 150)
    private String complement;

    @Column(nullable = false, length = 100)
    private String district;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(nullable = false, length = 2)
    private String state;

    @Column(name = "zip_code", nullable = false, length = 8)
    private String zipCode;

    protected Address() {
        // JPA
    }

    public Address(String street, String number, String complement, String district,
                   String city, String state, String zipCode) {
        this.street = street;
        this.number = number;
        this.complement = complement;
        this.district = district;
        this.city = city;
        this.state = state;
        this.zipCode = zipCode;
    }

    public String getStreet() {
        return street;
    }

    public String getNumber() {
        return number;
    }

    public String getComplement() {
        return complement;
    }

    public String getDistrict() {
        return district;
    }

    public String getCity() {
        return city;
    }

    public String getState() {
        return state;
    }

    public String getZipCode() {
        return zipCode;
    }
}
```

`src/main/java/com/foody/delivery/order/OrderItem.java`:

```java
package com.foody.delivery.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "product_name", nullable = false, length = 150)
    private String productName;

    @Column(name = "unit_price_cents", nullable = false)
    private long unitPriceCents;

    @Column(nullable = false)
    private int quantity;

    protected OrderItem() {
        // JPA
    }

    public OrderItem(String productName, long unitPriceCents, int quantity) {
        this.id = UUID.randomUUID().toString();
        this.productName = productName;
        this.unitPriceCents = unitPriceCents;
        this.quantity = quantity;
    }

    public String getId() {
        return id;
    }

    public String getProductName() {
        return productName;
    }

    public long getUnitPriceCents() {
        return unitPriceCents;
    }

    public int getQuantity() {
        return quantity;
    }

    public long subtotalCents() {
        return unitPriceCents * quantity;
    }
}
```

`src/main/java/com/foody/delivery/order/Order.java`:

```java
package com.foody.delivery.order;

import com.foody.delivery.shared.exception.ConflictException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrderStatus status;

    @Column(name = "total_cents", nullable = false)
    private long totalCents;

    @Embedded
    private Address deliveryAddress;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "order_id", nullable = false)
    private List<OrderItem> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Order() {
        // JPA
    }

    /**
     * Orders are born RECEBIDO and the total is ALWAYS computed here,
     * on the server, from the items. Never accepted from the client.
     */
    public static Order place(String userId, List<OrderItem> items, Address deliveryAddress) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Order requires at least one item");
        }
        Order order = new Order();
        order.id = UUID.randomUUID().toString();
        order.userId = userId;
        order.status = OrderStatus.RECEBIDO;
        order.items = new ArrayList<>(items);
        order.deliveryAddress = deliveryAddress;
        order.totalCents = items.stream().mapToLong(OrderItem::subtotalCents).sum();
        Instant now = Instant.now();
        order.createdAt = now;
        order.updatedAt = now;
        return order;
    }

    /** Transition rule enforced in the domain; invalid transition -> 409. */
    public void changeStatus(OrderStatus next) {
        if (!status.canTransitionTo(next)) {
            throw new ConflictException("Invalid status transition",
                    "Cannot change status from %s to %s".formatted(status, next));
        }
        this.status = next;
        this.updatedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public long getTotalCents() {
        return totalCents;
    }

    public Address getDeliveryAddress() {
        return deliveryAddress;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
```

`src/main/java/com/foody/delivery/order/OrderRepository.java`:

```java
package com.foody.delivery.order;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, String> {

    Page<Order> findByStatus(OrderStatus status, Pageable pageable);
}
```

- [ ] **Step 5: Write the integration-test base class**

`src/test/java/com/foody/delivery/AbstractIntegrationTest.java` — note the Boot 4 package for `@AutoConfigureMockMvc` (verified fact #5):

```java
package com.foody.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

/**
 * Base for all integration tests. Each concrete test class MUST declare its own
 * temp-FILE SQLite database (one per test class, per the spec — NEVER :memory:,
 * because each pooled connection would open its own empty database):
 *
 *   static final String JDBC_URL = newTempSqliteUrl();
 *
 *   @DynamicPropertySource
 *   static void datasource(DynamicPropertyRegistry registry) {
 *       registry.add("spring.datasource.url", () -> JDBC_URL);
 *   }
 *
 * Flyway runs against that file exactly as it does in production.
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class AbstractIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    protected static String newTempSqliteUrl() {
        String path = System.getProperty("java.io.tmpdir") + "/foody-test-" + UUID.randomUUID() + ".db";
        return "jdbc:sqlite:" + path + "?journal_mode=WAL&busy_timeout=5000";
    }
}
```

If `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc` does not resolve, fall back to the legacy `org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc` — but try the new package first; it is the documented Boot 4 location.

- [ ] **Step 6: Write the failing persistence round-trip test**

`src/test/java/com/foody/delivery/order/PersistenceIntegrationTest.java`:

```java
package com.foody.delivery.order;

import com.foody.delivery.AbstractIntegrationTest;
import com.foody.delivery.user.User;
import com.foody.delivery.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves that: Flyway migrations run on a fresh SQLite file, Hibernate
 * ddl-auto=validate accepts the schema, and entities round-trip
 * (UUID text ids, Instant as ISO-8601 text, money as long cents).
 */
class PersistenceIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void migrationsRunAndEntitiesRoundTrip() {
        User user = User.register("Rodrigo",
                "rodrigo-" + UUID.randomUUID() + "@example.com",
                "$2a$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcdefghi");
        userRepository.save(user);

        Address address = new Address("Rua das Flores", "100", null, "Centro",
                "São Paulo", "SP", "01001000");
        Order order = Order.place(user.getId(),
                List.of(new OrderItem("Pizza Calabresa", 4990L, 2)), address);
        orderRepository.save(order);

        Order reloaded = orderRepository.findById(order.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(OrderStatus.RECEBIDO);
        assertThat(reloaded.getTotalCents()).isEqualTo(9980L);
        assertThat(reloaded.getItems()).hasSize(1);
        assertThat(reloaded.getItems().get(0).getUnitPriceCents()).isEqualTo(4990L);
        assertThat(reloaded.getUserId()).isEqualTo(user.getId());
        assertThat(reloaded.getDeliveryAddress().getCity()).isEqualTo("São Paulo");
        assertThat(reloaded.getCreatedAt()).isEqualTo(order.getCreatedAt());
        assertThat(reloaded.getId()).hasSize(36);
    }
}
```

- [ ] **Step 7: Run the persistence test**

Run: `./mvnw test -Dtest=PersistenceIntegrationTest`
Expected: `Tests run: 1, Failures: 0` — BUILD SUCCESS. Startup log must show Flyway applying `V1` and `V2` to a `foody-test-*.db` file. If it fails with a Hibernate `SchemaManagementException` about a column type, apply the fallback rule from this task's preamble (rename the declared SQL type to the expected name reported in the error).

- [ ] **Step 8: Run the whole suite (regression) and commit**

Run: `./mvnw test`
Expected: OrderStatusTest (25) + PersistenceIntegrationTest (1) all pass.

```bash
git add src/main/resources/db src/main/java/com/foody/delivery/user src/main/java/com/foody/delivery/order src/test/java
git commit -m "feat: SQLite Flyway schema, User/Order entities and repositories validated by round-trip test"
```

---

### Task 5: Security — in-memory RSA JWT keys, filter chain, BCrypt

**Files:**
- Create: `src/main/java/com/foody/delivery/config/JwtKeyConfig.java`
- Create: `src/main/java/com/foody/delivery/config/SecurityConfig.java`
- Create: `src/test/java/com/foody/delivery/config/JwtKeyConfigTest.java`
- Create: `src/test/java/com/foody/delivery/config/SecurityIntegrationTest.java`

**Interfaces:**
- Consumes: Task 1 skeleton, `AbstractIntegrationTest` (Task 4).
- Produces:
  - Beans `RSAKey rsaKey()`, `JwtEncoder jwtEncoder(RSAKey)`, `JwtDecoder jwtDecoder(RSAKey)` — encoder AND decoder share the boot-generated in-memory keypair (self-issued JWT). `TokenService` (Task 6) injects `JwtEncoder`; the resource-server filter uses the `JwtDecoder` bean automatically (a user-declared `JwtDecoder` bean is all the oauth2-resource-server auto-config needs — no `issuer-uri` property).
  - Bean `PasswordEncoder passwordEncoder()` = `new BCryptPasswordEncoder(10)` — injected by `AuthService` (Task 6).
  - Filter chain: stateless, CSRF off, permits `/api/v1/auth/**`, `/swagger-ui/**`, `/swagger-ui.html`, `/v3/api-docs/**`; everything else authenticated via `oauth2ResourceServer(jwt)`.

- [ ] **Step 1: Write the failing key round-trip unit test**

`src/test/java/com/foody/delivery/config/JwtKeyConfigTest.java` (plain JUnit — no Spring context):

```java
package com.foody.delivery.config;

import com.nimbusds.jose.jwk.RSAKey;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class JwtKeyConfigTest {

    @Test
    void encoderIssuesTokenThatDecoderAccepts() throws Exception {
        JwtKeyConfig config = new JwtKeyConfig();
        RSAKey rsaKey = config.rsaKey();
        JwtEncoder encoder = config.jwtEncoder(rsaKey);
        JwtDecoder decoder = config.jwtDecoder(rsaKey);

        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject("user-1")
                .claim("email", "rodrigo@example.com")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();

        Jwt jwt = decoder.decode(token);
        assertThat(jwt.getSubject()).isEqualTo("user-1");
        assertThat(jwt.getClaimAsString("email")).isEqualTo("rodrigo@example.com");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./mvnw test -Dtest=JwtKeyConfigTest`
Expected: COMPILATION ERROR — `JwtKeyConfig` does not exist.

- [ ] **Step 3: Write JwtKeyConfig**

`src/main/java/com/foody/delivery/config/JwtKeyConfig.java`:

```java
package com.foody.delivery.config;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.UUID;

/**
 * RSA keypair generated in memory at boot. No key material is ever committed.
 * Documented consequence (README): restarting the application invalidates
 * every previously issued token.
 */
@Configuration
public class JwtKeyConfig {

    @Bean
    public RSAKey rsaKey() throws NoSuchAlgorithmException {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();
        return new RSAKey.Builder((RSAPublicKey) keyPair.getPublic())
                .privateKey((RSAPrivateKey) keyPair.getPrivate())
                .keyID(UUID.randomUUID().toString())
                .build();
    }

    @Bean
    public JwtEncoder jwtEncoder(RSAKey rsaKey) {
        JWKSource<SecurityContext> jwkSource = new ImmutableJWKSet<>(new JWKSet(rsaKey));
        return new NimbusJwtEncoder(jwkSource);
    }

    @Bean
    public JwtDecoder jwtDecoder(RSAKey rsaKey) throws JOSEException {
        return NimbusJwtDecoder.withPublicKey(rsaKey.toRSAPublicKey()).build();
    }
}
```

- [ ] **Step 4: Run the unit test**

Run: `./mvnw test -Dtest=JwtKeyConfigTest`
Expected: PASS.

- [ ] **Step 5: Write SecurityConfig**

`src/main/java/com/foody/delivery/config/SecurityConfig.java`:

```java
package com.foody.delivery.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Stateless token API: no session cookie, so CSRF protection is not applicable.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/auth/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }
}
```

- [ ] **Step 6: Write the security integration test**

`src/test/java/com/foody/delivery/config/SecurityIntegrationTest.java`:

```java
package com.foody.delivery.config;

import com.foody.delivery.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SecurityIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    @Test
    void ordersWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ordersWithGarbageTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/orders")
                        .header("Authorization", "Bearer not-a-real-jwt"))
                .andExpect(status().isUnauthorized());
    }
}
```

(These assertions stay valid after `OrderController` exists — unauthenticated requests are rejected before request mapping.)

- [ ] **Step 7: Run all tests**

Run: `./mvnw test`
Expected: all tests pass (25 + 1 + 1 + 2).

- [ ] **Step 8: Commit**

```bash
git add src/main/java/com/foody/delivery/config src/test/java/com/foody/delivery/config
git commit -m "feat: stateless JWT security with in-memory RSA keypair and BCrypt(10)"
```

---

### Task 6: Auth feature — DTOs, TokenService, AuthService, AuthController + integration tests

**Files:**
- Create: `src/main/java/com/foody/delivery/auth/dto/RegisterRequest.java`
- Create: `src/main/java/com/foody/delivery/auth/dto/RegisterResponse.java`
- Create: `src/main/java/com/foody/delivery/auth/dto/LoginRequest.java`
- Create: `src/main/java/com/foody/delivery/auth/dto/TokenResponse.java`
- Create: `src/main/java/com/foody/delivery/auth/TokenService.java`
- Create: `src/main/java/com/foody/delivery/auth/AuthService.java`
- Create: `src/main/java/com/foody/delivery/auth/AuthController.java`
- Create: `src/test/java/com/foody/delivery/auth/AuthFlowIntegrationTest.java`

**Interfaces:**
- Consumes: `User.register(...)`, `UserRepository.existsByEmail/findByEmail` (Task 4); `PasswordEncoder`, `JwtEncoder` beans (Task 5); `ConflictException(title, detail)`, `UnauthorizedException(detail)` (Task 2).
- Produces:
  - `record RegisterRequest(String name, String email, String password)` / `record RegisterResponse(String id, String name, String email)` / `record LoginRequest(String email, String password)` / `record TokenResponse(String accessToken, String tokenType, long expiresIn)`.
  - `AuthService.register(RegisterRequest) -> RegisterResponse` (409 on duplicate e-mail), `AuthService.login(LoginRequest) -> TokenResponse` (same generic 401 for unknown e-mail AND wrong password).
  - `TokenService.issue(User) -> TokenResponse` — claims `sub` = user id, `email`, `exp` = now + 3600s; `tokenType` "Bearer"; `expiresIn` 3600.
  - Endpoints `POST /api/v1/auth/register` (201) and `POST /api/v1/auth/login` (200) used by every later integration test to obtain tokens.

- [ ] **Step 1: Write the DTO records**

`auth/dto/RegisterRequest.java`:

```java
package com.foody.delivery.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Email @Size(max = 180) String email,
        @NotBlank @Size(min = 8, max = 72) String password) {
}
```

`auth/dto/RegisterResponse.java` (never carries the password hash — acceptance criterion 6):

```java
package com.foody.delivery.auth.dto;

public record RegisterResponse(String id, String name, String email) {
}
```

`auth/dto/LoginRequest.java`:

```java
package com.foody.delivery.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
}
```

`auth/dto/TokenResponse.java`:

```java
package com.foody.delivery.auth.dto;

public record TokenResponse(String accessToken, String tokenType, long expiresIn) {
}
```

- [ ] **Step 2: Write TokenService**

`auth/TokenService.java`:

```java
package com.foody.delivery.auth;

import com.foody.delivery.auth.dto.TokenResponse;
import com.foody.delivery.user.User;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class TokenService {

    static final long EXPIRES_IN_SECONDS = 3600;

    private final JwtEncoder jwtEncoder;

    public TokenService(JwtEncoder jwtEncoder) {
        this.jwtEncoder = jwtEncoder;
    }

    public TokenResponse issue(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(user.getId())
                .claim("email", user.getEmail())
                .issuedAt(now)
                .expiresAt(now.plusSeconds(EXPIRES_IN_SECONDS))
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
        return new TokenResponse(token, "Bearer", EXPIRES_IN_SECONDS);
    }
}
```

- [ ] **Step 3: Write AuthService**

`auth/AuthService.java`:

```java
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
```

- [ ] **Step 4: Write AuthController**

`auth/AuthController.java`:

```java
package com.foody.delivery.auth;

import com.foody.delivery.auth.dto.LoginRequest;
import com.foody.delivery.auth.dto.RegisterRequest;
import com.foody.delivery.auth.dto.RegisterResponse;
import com.foody.delivery.auth.dto.TokenResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }
}
```

- [ ] **Step 5: Write the auth integration tests**

`src/test/java/com/foody/delivery/auth/AuthFlowIntegrationTest.java`:

```java
package com.foody.delivery.auth;

import com.foody.delivery.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthFlowIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    private static String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    private static String registerJson(String email) {
        return """
                {"name": "Rodrigo", "email": "%s", "password": "senha-forte-123"}
                """.formatted(email);
    }

    private static String loginJson(String email, String password) {
        return """
                {"email": "%s", "password": "%s"}
                """.formatted(email, password);
    }

    @Test
    void registerReturns201WithoutExposingPasswordHash() throws Exception {
        String email = uniqueEmail();
        String body = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Rodrigo"))
                .andExpect(jsonPath("$.email").value(email))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContainIgnoringCase("password");
    }

    @Test
    void duplicateEmailReturns409ProblemDetail() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.title").value("E-mail already registered"))
                .andExpect(jsonPath("$.instance").value("/api/v1/auth/register"));
    }

    @Test
    void invalidRegisterPayloadReturns400WithFieldErrors() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "", "email": "not-an-email", "password": "123"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.errors").isNotEmpty());
    }

    @Test
    void loginReturnsBearerTokenWithOneHourExpiry() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "senha-forte-123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(3600));
    }

    @Test
    void wrongPasswordAndUnknownEmailReturnIdentical401() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated());

        String wrongPasswordBody = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "wrong-password-123")))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        String unknownEmailBody = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(uniqueEmail(), "senha-forte-123")))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        // Same route, same generic ProblemDetail: nothing distinguishes the two causes.
        assertThat(wrongPasswordBody).isEqualTo(unknownEmailBody);
    }

    @Test
    void tamperedTokenIsRejectedWith401() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated());
        String loginBody = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "senha-forte-123")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(loginBody).get("accessToken").asText();
        String forged = token.substring(0, token.length() - 5) + "AAAAA";

        mockMvc.perform(get("/api/v1/orders")
                        .header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 6: Run the auth tests, then the whole suite**

Run: `./mvnw test -Dtest=AuthFlowIntegrationTest`
Expected: 6 tests pass.
Run: `./mvnw test`
Expected: everything passes.

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/foody/delivery/auth src/test/java/com/foody/delivery/auth
git commit -m "feat: register/login with BCrypt and self-issued JWT, covered by integration tests"
```

---

### Task 7: Order DTOs, mapper and OrderService (TDD with Mockito)

**Files:**
- Create: `src/main/java/com/foody/delivery/order/dto/OrderItemRequest.java`
- Create: `src/main/java/com/foody/delivery/order/dto/AddressDto.java`
- Create: `src/main/java/com/foody/delivery/order/dto/CreateOrderRequest.java`
- Create: `src/main/java/com/foody/delivery/order/dto/UpdateStatusRequest.java`
- Create: `src/main/java/com/foody/delivery/order/dto/OrderItemResponse.java`
- Create: `src/main/java/com/foody/delivery/order/dto/OrderResponse.java`
- Create: `src/main/java/com/foody/delivery/order/dto/PageResponse.java`
- Create: `src/main/java/com/foody/delivery/order/OrderMapper.java`
- Create: `src/main/java/com/foody/delivery/order/OrderService.java`
- Test: `src/test/java/com/foody/delivery/order/OrderServiceTest.java`

**Interfaces:**
- Consumes: `Order`, `OrderItem`, `Address`, `OrderRepository`, `OrderStatus` (Tasks 3–4); `NotFoundException`, `ConflictException` (Task 2).
- Produces (exact signatures `OrderController` in Task 8 calls):
  - `OrderService.create(String userId, CreateOrderRequest request) -> OrderResponse`
  - `OrderService.getById(String id) -> OrderResponse`
  - `OrderService.list(OrderStatus status, int page, int size) -> PageResponse<OrderResponse>` (`status` nullable = no filter)
  - `OrderService.updateStatus(String id, OrderStatus newStatus) -> OrderResponse`
  - `OrderResponse(String id, String status, long totalCents, List<OrderItemResponse> items, AddressDto deliveryAddress, Instant createdAt, Instant updatedAt)` — `status` serialized as the enum name string.
  - `PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages)`.

- [ ] **Step 1: Write the DTO records**

`order/dto/OrderItemRequest.java` (money as `Long` cents; `@Min(0)` per spec `unit_price_cents >= 0`; `@Min(1)` quantity):

```java
package com.foody.delivery.order.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record OrderItemRequest(
        @NotBlank @Size(max = 150) String productName,
        @NotNull @Min(0) Long unitPriceCents,
        @NotNull @Min(1) Integer quantity) {
}
```

`order/dto/AddressDto.java` (used for request AND response; `complement` is the only nullable field):

```java
package com.foody.delivery.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddressDto(
        @NotBlank @Size(max = 150) String street,
        @NotBlank @Size(max = 20) String number,
        @Size(max = 150) String complement,
        @NotBlank @Size(max = 100) String district,
        @NotBlank @Size(max = 100) String city,
        @NotBlank @Size(min = 2, max = 2) String state,
        @NotBlank @Size(min = 8, max = 8) String zipCode) {
}
```

`order/dto/CreateOrderRequest.java` (no total field — the server computes it; at least one item):

```java
package com.foody.delivery.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreateOrderRequest(
        @NotEmpty @Valid List<OrderItemRequest> items,
        @NotNull @Valid AddressDto deliveryAddress) {
}
```

`order/dto/UpdateStatusRequest.java`:

```java
package com.foody.delivery.order.dto;

import com.foody.delivery.order.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateStatusRequest(@NotNull OrderStatus status) {
}
```

`order/dto/OrderItemResponse.java`:

```java
package com.foody.delivery.order.dto;

public record OrderItemResponse(String productName, long unitPriceCents, int quantity) {
}
```

`order/dto/OrderResponse.java`:

```java
package com.foody.delivery.order.dto;

import java.time.Instant;
import java.util.List;

public record OrderResponse(
        String id,
        String status,
        long totalCents,
        List<OrderItemResponse> items,
        AddressDto deliveryAddress,
        Instant createdAt,
        Instant updatedAt) {
}
```

`order/dto/PageResponse.java`:

```java
package com.foody.delivery.order.dto;

import java.util.List;

public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {
}
```

- [ ] **Step 2: Write OrderMapper**

`order/OrderMapper.java`:

```java
package com.foody.delivery.order;

import com.foody.delivery.order.dto.AddressDto;
import com.foody.delivery.order.dto.OrderItemRequest;
import com.foody.delivery.order.dto.OrderItemResponse;
import com.foody.delivery.order.dto.OrderResponse;

import java.util.List;

public final class OrderMapper {

    private OrderMapper() {
    }

    public static Address toAddress(AddressDto dto) {
        return new Address(dto.street(), dto.number(), dto.complement(), dto.district(),
                dto.city(), dto.state(), dto.zipCode());
    }

    public static List<OrderItem> toItems(List<OrderItemRequest> items) {
        return items.stream()
                .map(item -> new OrderItem(item.productName(), item.unitPriceCents(), item.quantity()))
                .toList();
    }

    public static OrderResponse toResponse(Order order) {
        Address address = order.getDeliveryAddress();
        return new OrderResponse(
                order.getId(),
                order.getStatus().name(),
                order.getTotalCents(),
                order.getItems().stream()
                        .map(item -> new OrderItemResponse(
                                item.getProductName(), item.getUnitPriceCents(), item.getQuantity()))
                        .toList(),
                new AddressDto(address.getStreet(), address.getNumber(), address.getComplement(),
                        address.getDistrict(), address.getCity(), address.getState(), address.getZipCode()),
                order.getCreatedAt(),
                order.getUpdatedAt());
    }
}
```

- [ ] **Step 3: Write the failing OrderService unit tests**

`src/test/java/com/foody/delivery/order/OrderServiceTest.java`:

```java
package com.foody.delivery.order;

import com.foody.delivery.order.dto.AddressDto;
import com.foody.delivery.order.dto.CreateOrderRequest;
import com.foody.delivery.order.dto.OrderItemRequest;
import com.foody.delivery.order.dto.OrderResponse;
import com.foody.delivery.shared.exception.ConflictException;
import com.foody.delivery.shared.exception.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private OrderService orderService;

    private static AddressDto anyAddress() {
        return new AddressDto("Rua das Flores", "100", null, "Centro",
                "São Paulo", "SP", "01001000");
    }

    private static Address anyDomainAddress() {
        return new Address("Rua das Flores", "100", null, "Centro",
                "São Paulo", "SP", "01001000");
    }

    private static CreateOrderRequest requestWithTwoItems() {
        return new CreateOrderRequest(
                List.of(new OrderItemRequest("Pizza Calabresa", 4990L, 2),
                        new OrderItemRequest("Guaraná 2L", 1500L, 1)),
                anyAddress());
    }

    @Test
    void createComputesTotalOnServerFromItems() {
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.create("user-1", requestWithTwoItems());

        assertThat(response.totalCents()).isEqualTo(4990L * 2 + 1500L);
    }

    @Test
    void createdOrderStartsAsRecebido() {
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.create("user-1", requestWithTwoItems());

        assertThat(response.status()).isEqualTo("RECEBIDO");
    }

    @Test
    void validTransitionUpdatesStatus() {
        Order order = Order.place("user-1",
                List.of(new OrderItem("Pizza", 4990L, 1)), anyDomainAddress());
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.updateStatus(order.getId(), OrderStatus.EM_PREPARO);

        assertThat(response.status()).isEqualTo("EM_PREPARO");
    }

    @Test
    void invalidTransitionThrowsConflictAndDoesNotSave() {
        Order order = Order.place("user-1",
                List.of(new OrderItem("Pizza", 4990L, 1)), anyDomainAddress());
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.updateStatus(order.getId(), OrderStatus.ENTREGUE))
                .isInstanceOf(ConflictException.class);
        verify(orderRepository, never()).save(any());
    }

    @Test
    void updateStatusOnUnknownOrderThrowsNotFound() {
        when(orderRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.updateStatus("missing", OrderStatus.EM_PREPARO))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void getByIdOnUnknownOrderThrowsNotFound() {
        when(orderRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.getById("missing"))
                .isInstanceOf(NotFoundException.class);
    }
}
```

- [ ] **Step 4: Run to verify failure**

Run: `./mvnw test -Dtest=OrderServiceTest`
Expected: COMPILATION ERROR — `OrderService` does not exist (DTOs and mapper compile).

- [ ] **Step 5: Implement OrderService**

`order/OrderService.java`:

```java
package com.foody.delivery.order;

import com.foody.delivery.order.dto.CreateOrderRequest;
import com.foody.delivery.order.dto.OrderResponse;
import com.foody.delivery.order.dto.PageResponse;
import com.foody.delivery.shared.exception.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional
    public OrderResponse create(String userId, CreateOrderRequest request) {
        Order order = Order.place(
                userId,
                OrderMapper.toItems(request.items()),
                OrderMapper.toAddress(request.deliveryAddress()));
        orderRepository.save(order);
        return OrderMapper.toResponse(order);
    }

    @Transactional(readOnly = true)
    public OrderResponse getById(String id) {
        return OrderMapper.toResponse(findOrder(id));
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderResponse> list(OrderStatus status, int page, int size) {
        // ISO-8601 text sorts chronologically, so ordering by created_at works on SQLite.
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> orders = status == null
                ? orderRepository.findAll(pageable)
                : orderRepository.findByStatus(status, pageable);
        return new PageResponse<>(
                orders.getContent().stream().map(OrderMapper::toResponse).toList(),
                orders.getNumber(),
                orders.getSize(),
                orders.getTotalElements(),
                orders.getTotalPages());
    }

    @Transactional
    public OrderResponse updateStatus(String id, OrderStatus newStatus) {
        Order order = findOrder(id);
        order.changeStatus(newStatus);
        orderRepository.save(order);
        return OrderMapper.toResponse(order);
    }

    private Order findOrder(String id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Order %s not found".formatted(id)));
    }
}
```

- [ ] **Step 6: Run the unit tests, then the whole suite**

Run: `./mvnw test -Dtest=OrderServiceTest`
Expected: 6 tests pass.
Run: `./mvnw test`
Expected: everything passes.

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/foody/delivery/order src/test/java/com/foody/delivery/order/OrderServiceTest.java
git commit -m "feat: OrderService with server-computed totals and domain-enforced transitions (unit tested)"
```

---

### Task 8: OrderController + end-to-end order flow integration test

**Files:**
- Create: `src/main/java/com/foody/delivery/order/OrderController.java`
- Test: `src/test/java/com/foody/delivery/order/OrderFlowIntegrationTest.java`

**Interfaces:**
- Consumes: `OrderService` (Task 7 signatures), auth endpoints (Task 6) for tokens, security chain (Task 5).
- Produces: the four order endpoints from the spec table — `POST /api/v1/orders` (201 + `Location`), `GET /api/v1/orders?status=&page=&size=` (200 paginated), `GET /api/v1/orders/{id}` (200/404), `PATCH /api/v1/orders/{id}/status` (200/404/409). The authenticated user id comes from the JWT `sub` claim.

- [ ] **Step 1: Write OrderController**

`order/OrderController.java`:

```java
package com.foody.delivery.order;

import com.foody.delivery.order.dto.CreateOrderRequest;
import com.foody.delivery.order.dto.OrderResponse;
import com.foody.delivery.order.dto.PageResponse;
import com.foody.delivery.order.dto.UpdateStatusRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<OrderResponse> create(@AuthenticationPrincipal Jwt jwt,
                                                @Valid @RequestBody CreateOrderRequest request) {
        OrderResponse response = orderService.create(jwt.getSubject(), request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(response.id())
                .toUri();
        return ResponseEntity.created(location).body(response);
    }

    @GetMapping
    public PageResponse<OrderResponse> list(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return orderService.list(status, page, size);
    }

    @GetMapping("/{id}")
    public OrderResponse getById(@PathVariable String id) {
        return orderService.getById(id);
    }

    @PatchMapping("/{id}/status")
    public OrderResponse updateStatus(@PathVariable String id,
                                      @Valid @RequestBody UpdateStatusRequest request) {
        return orderService.updateStatus(id, request.status());
    }
}
```

- [ ] **Step 2: Write the order flow integration test**

`src/test/java/com/foody/delivery/order/OrderFlowIntegrationTest.java`:

```java
package com.foody.delivery.order;

import com.foody.delivery.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderFlowIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    private static final String CREATE_ORDER_JSON = """
            {
              "items": [
                { "productName": "Pizza Calabresa", "unitPriceCents": 4990, "quantity": 2 },
                { "productName": "Guaraná 2L", "unitPriceCents": 1500, "quantity": 1 }
              ],
              "deliveryAddress": {
                "street": "Rua das Flores", "number": "100", "complement": null,
                "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"
              }
            }
            """;

    private String authToken() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Test User", "email": "%s", "password": "senha-forte-123"}
                                """.formatted(email)))
                .andExpect(status().isCreated());
        String body = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "%s", "password": "senha-forte-123"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("accessToken").asText();
    }

    private String createOrder(String token) throws Exception {
        String body = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    private void patchStatus(String token, String orderId, String newStatus,
                             org.springframework.test.web.servlet.ResultMatcher expected) throws Exception {
        mockMvc.perform(patch("/api/v1/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"" + newStatus + "\"}"))
                .andExpect(expected);
    }

    @Test
    void createOrderComputesTotalServerSideAndReturnsLocation() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/v1/orders/")))
                .andExpect(jsonPath("$.status").value("RECEBIDO"))
                .andExpect(jsonPath("$.totalCents").value(11480))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.deliveryAddress.city").value("São Paulo"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void createOrderWithoutItemsReturns400() throws Exception {
        String token = authToken();
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items": [], "deliveryAddress": {
                                  "street": "Rua das Flores", "number": "100", "complement": null,
                                  "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"}}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors").isArray());
    }

    @Test
    void getByIdReturnsOrderAndUnknownIdReturns404() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);

        mockMvc.perform(get("/api/v1/orders/" + orderId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(orderId));

        mockMvc.perform(get("/api/v1/orders/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }

    @Test
    void listIsPaginatedAndFiltersByStatus() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);
        patchStatus(token, orderId, "EM_PREPARO", status().isOk());
        createOrder(token);

        mockMvc.perform(get("/api/v1/orders")
                        .param("page", "0").param("size", "10")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").isNumber());

        mockMvc.perform(get("/api/v1/orders")
                        .param("status", "EM_PREPARO")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].status",
                        org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is("EM_PREPARO"))));
    }

    @Test
    void statusAdvancesThroughHappyPathAndIllegalTransitionReturns409() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);

        patchStatus(token, orderId, "EM_PREPARO", status().isOk());
        patchStatus(token, orderId, "SAIU_PARA_ENTREGA", status().isOk());
        patchStatus(token, orderId, "ENTREGUE", status().isOk());

        mockMvc.perform(patch("/api/v1/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"EM_PREPARO\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.title").value("Invalid status transition"))
                .andExpect(jsonPath("$.detail")
                        .value("Cannot change status from ENTREGUE to EM_PREPARO"));
    }

    @Test
    void skippingAStateReturns409() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);
        patchStatus(token, orderId, "ENTREGUE", status().isConflict());
    }

    @Test
    void cancelAfterDispatchReturns409() throws Exception {
        String token = authToken();
        String orderId = createOrder(token);
        patchStatus(token, orderId, "EM_PREPARO", status().isOk());
        patchStatus(token, orderId, "SAIU_PARA_ENTREGA", status().isOk());
        patchStatus(token, orderId, "CANCELADO", status().isConflict());
    }

    @Test
    void patchStatusOnUnknownOrderReturns404() throws Exception {
        String token = authToken();
        patchStatus(token, UUID.randomUUID().toString(), "EM_PREPARO", status().isNotFound());
    }

    @Test
    void allOrderEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_ORDER_JSON))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/orders")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/orders/some-id")).andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/v1/orders/some-id/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"EM_PREPARO\"}"))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 3: Run the flow test, then the whole suite**

Run: `./mvnw test -Dtest=OrderFlowIntegrationTest`
Expected: 9 tests pass.
Run: `./mvnw test`
Expected: everything passes (this covers the spec's "register → login → /orders with token → 200" integration requirement).

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/foody/delivery/order/OrderController.java src/test/java/com/foody/delivery/order/OrderFlowIntegrationTest.java
git commit -m "feat: order endpoints with Location header, pagination, status filter and 409 on illegal transitions"
```

---

### Task 9: OpenAPI / Swagger UI

**Files:**
- Create: `src/main/java/com/foody/delivery/config/OpenApiConfig.java`
- Test: `src/test/java/com/foody/delivery/order/SwaggerIntegrationTest.java`

**Interfaces:**
- Consumes: springdoc dependency (Task 1), security permits for `/swagger-ui/**` and `/v3/api-docs/**` (Task 5).
- Produces: Swagger UI at `/swagger-ui/index.html`, OpenAPI JSON at `/v3/api-docs`, with a bearer-JWT security scheme so the "Authorize" button accepts tokens.

- [ ] **Step 1: Write OpenApiConfig**

`config/OpenApiConfig.java`:

```java
package com.foody.delivery.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI foodyOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("FoodyDelivery API")
                        .description("Delivery REST API: auth + order management over SQLite")
                        .version("v1"))
                .components(new Components().addSecuritySchemes("bearer-jwt",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearer-jwt"));
    }
}
```

- [ ] **Step 2: Write the swagger availability test**

`src/test/java/com/foody/delivery/order/SwaggerIntegrationTest.java`:

```java
package com.foody.delivery.order;

import com.foody.delivery.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SwaggerIntegrationTest extends AbstractIntegrationTest {

    static final String JDBC_URL = newTempSqliteUrl();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
    }

    @Test
    void openApiDocsArePublic() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("FoodyDelivery API"))
                .andExpect(jsonPath("$.paths['/api/v1/orders']").exists());
    }
}
```

- [ ] **Step 3: Run the test, then the whole suite**

Run: `./mvnw test -Dtest=SwaggerIntegrationTest`
Expected: PASS.
Run: `./mvnw test`
Expected: everything passes.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/foody/delivery/config/OpenApiConfig.java src/test/java/com/foody/delivery/order/SwaggerIntegrationTest.java
git commit -m "feat: OpenAPI metadata with bearer-JWT scheme and public swagger docs"
```

---

### Task 10: README + full acceptance verification (live curl flow)

**Files:**
- Create: `/Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery/README.md`

**Interfaces:**
- Consumes: everything. This task changes no production code; it documents and proves the acceptance criteria.

- [ ] **Step 1: Write `README.md`**

```markdown
# FoodyDelivery API

REST API de delivery: cadastro/login com JWT e gestão de pedidos com máquina de estados.
Java 21 · Spring Boot 4 · SQLite · Flyway · Spring Security (resource server).

## Como rodar

Sem dependência externa — sem Docker, sem banco instalado (SQLite é embutido):

```bash
./mvnw spring-boot:run
```

A API sobe em `http://localhost:8080`. O banco é criado em `./data/foody.db` pelas
migrations do Flyway na primeira subida.

Testes:

```bash
./mvnw test
```

Os testes de integração rodam contra um arquivo SQLite temporário por classe de teste
(nunca `:memory:`), com as mesmas migrations Flyway de produção.

## Swagger

- UI: http://localhost:8080/swagger-ui/index.html
- OpenAPI JSON: http://localhost:8080/v3/api-docs

Use o botão **Authorize** com o `accessToken` retornado pelo login.

## Decisões e porquês

- **SQLite**: zero-setup para o avaliador. Restrições tratadas explicitamente:
  `journal_mode=WAL` + `busy_timeout=5000` na URL (um writer por vez), migrations
  sempre aditivas (`ALTER TABLE` limitado).
- **Dinheiro em `long` de centavos** (`unit_price_cents`, `total_cents`): SQLite não tem
  `DECIMAL` real — armazenaria como ponto flutuante e perderia centavos. `double`/`float`
  são proibidos para dinheiro. O total é sempre calculado no servidor a partir dos itens.
- **UUID como TEXT(36), datas como ISO-8601 (`Instant`)**: SQLite não tem tipos nativos
  para nenhum dos dois.
- **JWT com par RSA gerado em memória no boot**: nenhuma chave é commitada.
  **Consequência: reiniciar a aplicação invalida os tokens emitidos.** Claims: `sub` = id
  do usuário, `email`, expiração de 1 hora. Sem refresh token (YAGNI para o escopo).
- **Sem roles**: qualquer usuário autenticado enxerga todos os pedidos (decisão de escopo).
- **Regra de cancelamento**: depois de `SAIU_PARA_ENTREGA` o pedido não pode mais ser
  cancelado. A máquina de estados mora no enum `OrderStatus`; transição inválida → `409`
  com `ProblemDetail` (RFC 7807).
- Login com e-mail inexistente e com senha errada retornam a **mesma** resposta `401`,
  para não revelar quais e-mails estão cadastrados.

## Máquina de estados

```
RECEBIDO           → EM_PREPARO, CANCELADO
EM_PREPARO         → SAIU_PARA_ENTREGA, CANCELADO
SAIU_PARA_ENTREGA  → ENTREGUE
ENTREGUE           → (terminal)
CANCELADO          → (terminal)
```

## Fluxo completo (curl)

```bash
# 1. Registrar
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Rodrigo","email":"rodrigo@example.com","password":"senha-forte-123"}'

# 2. Login (guarde o accessToken)
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rodrigo@example.com","password":"senha-forte-123"}' | \
  python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')

# 3. Criar pedido (201 + header Location; totalCents calculado no servidor = 11480)
curl -si -X POST http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "items": [
      {"productName": "Pizza Calabresa", "unitPriceCents": 4990, "quantity": 2},
      {"productName": "Guaraná 2L", "unitPriceCents": 1500, "quantity": 1}
    ],
    "deliveryAddress": {
      "street": "Rua das Flores", "number": "100", "complement": null,
      "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"
    }
  }'

# 4. Listar (paginado; filtro opcional ?status=RECEBIDO)
curl -s "http://localhost:8080/api/v1/orders?page=0&size=10" \
  -H "Authorization: Bearer $TOKEN"

# 5. Buscar por id (use o id retornado no passo 3)
curl -s http://localhost:8080/api/v1/orders/<ID> -H "Authorization: Bearer $TOKEN"

# 6. Avançar status (RECEBIDO → EM_PREPARO)
curl -s -X PATCH http://localhost:8080/api/v1/orders/<ID>/status \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status": "EM_PREPARO"}'

# 7. Transição ilegal → 409 ProblemDetail
curl -s -X PATCH http://localhost:8080/api/v1/orders/<ID>/status \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status": "ENTREGUE"}'

# 8. Sem token → 401
curl -si http://localhost:8080/api/v1/orders
```
```

- [ ] **Step 2: Run the full test suite**

Run: `./mvnw test`
Expected: BUILD SUCCESS, zero failures (acceptance criterion 1).

- [ ] **Step 3: Live smoke test — boot the app and run the curl flow**

```bash
./mvnw spring-boot:run &
APP_PID=$!
sleep 25   # first boot compiles + runs Flyway
```

Then execute, in order (acceptance criteria 2–5):
1. The register curl from the README → HTTP 201 JSON with `id`, `name`, `email` — and no password field.
2. The login curl → `accessToken` captured.
3. `curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/v1/orders` → `401` (criterion 3).
4. Create order curl → `201`, response has `"status":"RECEBIDO"` and `"totalCents":11480`, `Location` header present.
5. List + get by id → `200`.
6. PATCH to `EM_PREPARO` → `200`; PATCH to `ENTREGUE` directly after would be from EM_PREPARO — instead PATCH `{"status":"RECEBIDO"}` → `409` with a `ProblemDetail` body (`"title":"Invalid status transition"`) (criterion 5).
7. `curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/v3/api-docs` → `200`.

Finally:

```bash
kill $APP_PID
```

Expected: every status code as listed. Also confirm `./data/foody.db` was created.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with run instructions, design decisions and full curl flow"
```

---

## Spec coverage map

| Spec section | Task(s) |
|---|---|
| §2 Stack + SQLite mitigations (WAL, busy_timeout, cents, TEXT ids/dates, additive migrations) | 1, 2, 4 |
| §3 Data model + integrity rules (server-side total, born RECEBIDO, ≥1 item, quantity/price bounds) | 4, 7 |
| §4 State machine in `OrderStatus`, invalid → 409 | 3, 4, 8 |
| §5 API contracts + RFC 7807 errors + `errors` extension on 400 | 2, 6, 7, 8 |
| §6 Security (BCrypt 10, in-memory RSA JWT, claims, stateless, CSRF off, public routes, uniform 401) | 5, 6 |
| §7 Package-by-feature layout | all (file map above) |
| §8 Tests (5×5 unit matrix, OrderService unit, auth + order integration on temp-file SQLite) | 3, 4, 5, 6, 7, 8 |
| §9 README | 10 |
| §10 Acceptance criteria | 10 (live verification) |

## Concerns

Things noticed while planning that the executor and reviewer should know. None change the spec's design — where the spec and the Boot 4 reality diverge on names, the divergence is recorded here instead of being silently absorbed:

1. **Starter names**: the spec lists `spring-boot-starter-web` and `spring-boot-starter-oauth2-resource-server`. In Spring Boot 4.x both are deprecated relocations; the plan uses the current equivalents `spring-boot-starter-webmvc` and `spring-boot-starter-security-oauth2-resource-server` (verified on Maven Central at 4.1.0). Same modules, same behavior — only the artifact ids changed with Boot 4.
2. **Boot version pinned to 4.1.0, not 4.0.x**: Boot 4.0.3 manages Flyway 11.14.1, and `flyway-database-nc-sqlite` does not exist below Flyway 12.3.0. The spec's `flyway-core` + `flyway-database-nc-sqlite` combination therefore requires Boot ≥ 4.1.0 (Flyway 12.4.0) — or a manual `flyway.version` override on 4.0.x, which the plan avoids as more fragile.
3. **`flyway-database-nc-sqlite` is not BOM-managed**: it must carry `<version>${flyway.version}</version>` in the pom. Removing that version tag breaks the build.
4. **Boot 4 Flyway autoconfig**: bare `flyway-core` no longer triggers migrations (autoconfiguration moved to the `spring-boot-flyway` module), hence `spring-boot-starter-flyway` in the pom alongside the spec-mandated `flyway-core`.
5. **DDL type names vs. spec's `TEXT(36)`/`INTEGER`**: migrations declare `varchar(36)`/`bigint`/`integer`. In SQLite these produce exactly the TEXT/INTEGER storage classes the spec requires (type affinity), but keep Hibernate's `ddl-auto: validate` satisfied, since the validator compares JDBC type codes derived from the declared names. The mitigation itself (no floating-point money, text UUIDs/dates) is fully preserved.
6. **One Spring context per integration test class**: the spec mandates a temp DB file *per test class*, which forces a distinct context per class (distinct datasource property) and makes the suite slower than a shared context. Accepted as spec-mandated.
7. **401 body shape for missing/invalid tokens**: the resource-server filter rejects those before MVC, returning 401 with a `WWW-Authenticate` header and an empty body — not a `ProblemDetail`. The spec only requires the 401 status there, so this is compliant; only login failures (which reach the advice) carry a ProblemDetail body.
8. **`@AutoConfigureMockMvc` package**: Boot 4 moved it to `org.springframework.boot.webmvc.test.autoconfigure` (documented in Boot 4.0.3 reference). If a future Boot patch relocates it again, the legacy fallback is noted in Task 4 Step 5.
```
