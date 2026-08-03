-- Demo data: one account (demo@foody.dev / senha1234) and six orders covering
-- every status, so a fresh checkout shows a populated board.
-- password_hash is a real BCrypt(10) hash produced by the application itself.
-- Timestamps are computed at migration time so the cards read as recent.
INSERT OR IGNORE INTO users (id, name, email, password_hash, created_at) VALUES
    ('7f3d1c02-9a44-4d7e-b1f0-2c6a5e8b4d11', 'Demo Foody', 'demo@foody.dev',
     '$2a$10$Ay5jGNy7fCboSzB4ahArxeOZ11n8QrtkIjX.Cn8GvmBXNT5HpRdee',
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days'));

INSERT INTO orders (id, user_id, status, total_cents, street, number, complement,
                    district, city, state, zip_code, created_at, updated_at) VALUES
    ('a1c94f6d-3b28-4e51-9c07-8d2f6b1a5e30', '7f3d1c02-9a44-4d7e-b1f0-2c6a5e8b4d11',
     'RECEBIDO', 7090, 'Avenida Paulista', '1578', 'Apto 42',
     'Bela Vista', 'São Paulo', 'SP', '01310100',
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-6 minutes'),
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-6 minutes')),

    ('b7e05a19-6c33-4a8d-8f22-1e94c7d0b6a2', '7f3d1c02-9a44-4d7e-b1f0-2c6a5e8b4d11',
     'RECEBIDO', 7780, 'Rua Augusta', '901', NULL,
     'Consolação', 'São Paulo', 'SP', '01305100',
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-14 minutes'),
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-14 minutes')),

    ('c25b8347-df10-4b96-a3e8-70f1d9c26b45', '7f3d1c02-9a44-4d7e-b1f0-2c6a5e8b4d11',
     'EM_PREPARO', 11640, 'Rua Oscar Freire', '379', 'Casa 2',
     'Jardins', 'São Paulo', 'SP', '01426001',
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-28 minutes'),
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-9 minutes')),

    ('d8f6120e-4a75-4c39-b0d1-6e3a82f5c974', '7f3d1c02-9a44-4d7e-b1f0-2c6a5e8b4d11',
     'SAIU_PARA_ENTREGA', 8990, 'Alameda Santos', '2233', NULL,
     'Cerqueira César', 'São Paulo', 'SP', '01419002',
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-52 minutes'),
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-16 minutes')),

    ('e0a37b58-9d62-4f14-8a75-3c1b6d40e829', '7f3d1c02-9a44-4d7e-b1f0-2c6a5e8b4d11',
     'ENTREGUE', 9800, 'Rua da Consolação', '2000', 'Bloco B',
     'Consolação', 'São Paulo', 'SP', '01302001',
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours'),
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-71 minutes')),

    ('f491c6a2-70b8-4d05-9e63-2a8f5c17b3d6', '7f3d1c02-9a44-4d7e-b1f0-2c6a5e8b4d11',
     'CANCELADO', 3980, 'Rua Haddock Lobo', '595', NULL,
     'Cerqueira César', 'São Paulo', 'SP', '01414001',
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-95 minutes'),
     strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-88 minutes'));

INSERT INTO order_items (id, order_id, product_name, unit_price_cents, quantity) VALUES
    ('1a5c8e30-2b47-4f19-8d06-9c3e7b15a248', 'a1c94f6d-3b28-4e51-9c07-8d2f6b1a5e30', 'Pizza Margherita', 4590, 1),
    ('2b6d9f41-3c58-4a20-9e17-0d4f8c26b359', 'a1c94f6d-3b28-4e51-9c07-8d2f6b1a5e30', 'Guaraná 2L', 1250, 2),

    ('3c7e0a52-4d69-4b31-af28-1e5a9d37c460', 'b7e05a19-6c33-4a8d-8f22-1e94c7d0b6a2', 'Yakisoba de frango', 3890, 2),

    ('4d8f1b63-5e70-4c42-b039-2f6b0e48d571', 'c25b8347-df10-4b96-a3e8-70f1d9c26b45', 'Hambúrguer artesanal', 3250, 3),
    ('5e902c74-6f81-4d53-8140-3a7c1f59e682', 'c25b8347-df10-4b96-a3e8-70f1d9c26b45', 'Batata frita grande', 1890, 1),

    ('6fa13d85-7092-4e64-9251-4b8d2a60f793', 'd8f6120e-4a75-4c39-b0d1-6e3a82f5c974', 'Combinado 20 peças', 8990, 1),

    ('70b24e96-81a3-4f75-a362-5c9e3b71a804', 'e0a37b58-9d62-4f14-8a75-3c1b6d40e829', 'Marmita executiva', 2450, 4),

    ('81c35fa7-92b4-4086-b473-6d0f4c82b915', 'f491c6a2-70b8-4d05-9e63-2a8f5c17b3d6', 'Açaí 500ml', 1990, 2);
