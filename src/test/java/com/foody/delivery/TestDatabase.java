package com.foody.delivery;

import java.util.UUID;

public final class TestDatabase {

    private TestDatabase() {
    }

    public static String newTempSqliteUrl() {
        String path = System.getProperty("java.io.tmpdir") + "/foody-test-" + UUID.randomUUID() + ".db";
        return "jdbc:sqlite:" + path + "?journal_mode=WAL&busy_timeout=5000&foreign_keys=true";
    }
}
