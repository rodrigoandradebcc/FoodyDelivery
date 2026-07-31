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
