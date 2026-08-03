-- Demo data: one account (demo@foody.dev / senha1234) and six orders covering
-- every status, so a fresh checkout shows a populated board.
-- password_hash is a real BCrypt(10) hash produced by the application itself.
INSERT OR IGNORE INTO users (id, name, email, password_hash, created_at) VALUES
    ('00000000-0000-4000-8000-000000000001', 'Demo Foody', 'demo@foody.dev',
     '$2a$10$Ay5jGNy7fCboSzB4ahArxeOZ11n8QrtkIjX.Cn8GvmBXNT5HpRdee',
     '2026-08-03T12:00:00Z');

INSERT INTO orders (id, user_id, status, total_cents, street, number, complement,
                    district, city, state, zip_code, created_at, updated_at) VALUES
    ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001',
     'RECEBIDO', 7090, 'Avenida Paulista', '1578', 'Apto 42',
     'Bela Vista', 'São Paulo', 'SP', '01310100',
     '2026-08-03T12:05:00Z', '2026-08-03T12:05:00Z'),

    ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001',
     'RECEBIDO', 7780, 'Rua Augusta', '901', NULL,
     'Consolação', 'São Paulo', 'SP', '01305100',
     '2026-08-03T12:12:00Z', '2026-08-03T12:12:00Z'),

    ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001',
     'EM_PREPARO', 11640, 'Rua Oscar Freire', '379', 'Casa 2',
     'Jardins', 'São Paulo', 'SP', '01426001',
     '2026-08-03T11:40:00Z', '2026-08-03T12:02:00Z'),

    ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001',
     'SAIU_PARA_ENTREGA', 8990, 'Alameda Santos', '2233', NULL,
     'Cerqueira César', 'São Paulo', 'SP', '01419002',
     '2026-08-03T11:20:00Z', '2026-08-03T11:58:00Z'),

    ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001',
     'ENTREGUE', 9800, 'Rua da Consolação', '2000', 'Bloco B',
     'Consolação', 'São Paulo', 'SP', '01302001',
     '2026-08-03T10:30:00Z', '2026-08-03T11:15:00Z'),

    ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001',
     'CANCELADO', 3980, 'Rua Haddock Lobo', '595', NULL,
     'Cerqueira César', 'São Paulo', 'SP', '01414001',
     '2026-08-03T10:50:00Z', '2026-08-03T11:05:00Z');

INSERT INTO order_items (id, order_id, product_name, unit_price_cents, quantity) VALUES
    ('00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000000101', 'Pizza Margherita', 4590, 1),
    ('00000000-0000-4000-8000-000000001012', '00000000-0000-4000-8000-000000000101', 'Guaraná 2L', 1250, 2),

    ('00000000-0000-4000-8000-000000001021', '00000000-0000-4000-8000-000000000102', 'Yakisoba de frango', 3890, 2),

    ('00000000-0000-4000-8000-000000001031', '00000000-0000-4000-8000-000000000103', 'Hambúrguer artesanal', 3250, 3),
    ('00000000-0000-4000-8000-000000001032', '00000000-0000-4000-8000-000000000103', 'Batata frita grande', 1890, 1),

    ('00000000-0000-4000-8000-000000001041', '00000000-0000-4000-8000-000000000104', 'Combinado 20 peças', 8990, 1),

    ('00000000-0000-4000-8000-000000001051', '00000000-0000-4000-8000-000000000105', 'Marmita executiva', 2450, 4),

    ('00000000-0000-4000-8000-000000001061', '00000000-0000-4000-8000-000000000106', 'Açaí 500ml', 1990, 2);
