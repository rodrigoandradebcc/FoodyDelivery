-- SQLite: varchar(...) columns get TEXT affinity (= TEXT storage class).
-- Timestamps are ISO-8601 text. IDs are 36-char UUID text.
CREATE TABLE users (
    id            varchar(36)  NOT NULL PRIMARY KEY,
    name          varchar(120) NOT NULL,
    email         varchar(180) NOT NULL UNIQUE,
    password_hash varchar(60)  NOT NULL,
    created_at    varchar(35)  NOT NULL
);
