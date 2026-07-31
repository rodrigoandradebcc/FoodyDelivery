package com.foody.delivery;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

/**
 * Base for all integration tests. Each concrete test class MUST declare its own
 * temp-FILE SQLite database (one per test class, per the spec — NEVER :memory:,
 * because each pooled connection would open its own empty database):
 *
 * <pre>
 *   static final String JDBC_URL = newTempSqliteUrl();
 *
 *   &#64;DynamicPropertySource
 *   static void datasource(DynamicPropertyRegistry registry) {
 *       registry.add("spring.datasource.url", () -&gt; JDBC_URL);
 *   }
 * </pre>
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
