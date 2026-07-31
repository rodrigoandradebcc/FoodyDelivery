# FoodyDelivery API — Design

**Data:** 2026-07-31
**Contexto:** teste técnico. Avaliador roda o projeto e lê o código.
**Prazo assumido:** ~2-3 dias.

## 1. Escopo

API REST de delivery com autenticação e gestão de pedidos.

**Dentro do escopo:**
- Cadastro de usuário (nome, e-mail, senha)
- Login por e-mail + senha, retornando token
- Todos os endpoints de pedido exigem autenticação
- Criar pedido (itens + endereço de entrega)
- Atualizar status do pedido com transições validadas
- Listar pedidos (paginado, filtro opcional por status) e buscar por ID

**Fora do escopo (YAGNI):**
- Refresh token, logout, recuperação de senha
- Roles/permissões — qualquer usuário autenticado enxerga todos os pedidos
- Catálogo de produtos (o item do pedido carrega nome e preço)
- Pagamento, entregador, rastreamento, notificações
- Frontend

## 2. Stack

- Java 21, Spring Boot 4.x, Maven
- `spring-boot-starter-web`, `-data-jpa`, `-validation`, `-security`, `-oauth2-resource-server`
- `org.xerial:sqlite-jdbc` + `org.hibernate.orm:hibernate-community-dialects`
- Flyway: `flyway-core` + `flyway-database-nc-sqlite`
- springdoc-openapi (Swagger UI)
- Testes: JUnit 5, Mockito, MockMvc

```yaml
spring:
  datasource:
    url: jdbc:sqlite:./data/foody.db?journal_mode=WAL&busy_timeout=5000
  jpa:
    database-platform: org.hibernate.community.dialect.SQLiteDialect
    hibernate:
      ddl-auto: validate     # schema vem do Flyway
```

### Restrições do SQLite tratadas explicitamente

1. **Dinheiro.** SQLite não tem `DECIMAL` real — armazena como `REAL` (ponto flutuante) e perde centavos.
   Decisão: todo valor monetário é `long` de centavos (`unit_price_cents`, `total_cents`).
   Proibido `double`/`float` para dinheiro.
2. **Concorrência de escrita.** SQLite aceita um writer por vez.
   Decisão: `journal_mode=WAL` e `busy_timeout=5000` na URL de conexão.
3. **Tipos ausentes.** Não há `UUID` nem `TIMESTAMP` nativos.
   Decisão: UUID como `TEXT(36)`; datas como ISO-8601 via `java.time.Instant`.
4. **Migrations.** `ALTER TABLE` é limitado.
   Decisão: migrations sempre aditivas.

## 3. Modelo de dados

```
User        id(TEXT/UUID, PK) · name · email(UNIQUE) · password_hash · created_at
Order       id(TEXT/UUID, PK) · user_id(FK→User) · status(TEXT) · total_cents(INTEGER)
            · created_at · updated_at
            + endereço embutido: street, number, complement(nullable), district,
              city, state, zip_code
OrderItem   id(TEXT/UUID, PK) · order_id(FK→Order) · product_name
            · unit_price_cents(INTEGER) · quantity(INTEGER)
```

Regras de integridade:
- `total_cents` é sempre calculado no servidor a partir dos itens. Nunca aceito do cliente.
- Pedido nasce com status `RECEBIDO`. Cliente não envia status na criação.
- Pedido exige no mínimo um item; `quantity >= 1`; `unit_price_cents >= 0`.

Migrations:
- `V1__create_users.sql`
- `V2__create_orders_and_items.sql`

## 4. Máquina de estados

```
RECEBIDO           → EM_PREPARO, CANCELADO
EM_PREPARO         → SAIU_PARA_ENTREGA, CANCELADO
SAIU_PARA_ENTREGA  → ENTREGUE
ENTREGUE           → (terminal)
CANCELADO          → (terminal)
```

Decisão documentada: depois de `SAIU_PARA_ENTREGA` o pedido não pode mais ser cancelado.

A regra mora no enum `OrderStatus` (`Set<OrderStatus> allowedNext` + `canTransitionTo`), não no
controller. Transição inválida lança `ConflictException` → HTTP `409`.

## 5. API

Base: `/api/v1`

| Método | Rota | Auth | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/auth/register` | público | `201` | `409` e-mail duplicado · `400` validação |
| POST | `/auth/login` | público | `200` + token | `401` credencial inválida |
| POST | `/orders` | JWT | `201` + `Location` | `400` validação |
| GET | `/orders` | JWT | `200` paginado | — |
| GET | `/orders/{id}` | JWT | `200` | `404` |
| PATCH | `/orders/{id}/status` | JWT | `200` | `404` · `409` transição inválida |

`GET /orders` aceita `?status=`, `?page=`, `?size=`.

### Contratos

```jsonc
// POST /auth/register
{ "name": "Rodrigo", "email": "rodrigo@example.com", "password": "senha-forte-123" }
// → 201
{ "id": "uuid", "name": "Rodrigo", "email": "rodrigo@example.com" }

// POST /auth/login  →  200
{ "accessToken": "eyJ...", "tokenType": "Bearer", "expiresIn": 3600 }

// POST /orders
{
  "items": [
    { "productName": "Pizza Calabresa", "unitPriceCents": 4990, "quantity": 2 }
  ],
  "deliveryAddress": {
    "street": "Rua das Flores", "number": "100", "complement": null,
    "district": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"
  }
}
// → 201, header Location: /api/v1/orders/{id}
{
  "id": "uuid", "status": "RECEBIDO", "totalCents": 9980,
  "items": [ { "productName": "Pizza Calabresa", "unitPriceCents": 4990, "quantity": 2 } ],
  "deliveryAddress": { ... },
  "createdAt": "2026-07-31T13:00:00Z", "updatedAt": "2026-07-31T13:00:00Z"
}

// PATCH /orders/{id}/status
{ "status": "EM_PREPARO" }
// → 200, pedido completo atualizado
```

### Erros — RFC 7807 `ProblemDetail`

`@RestControllerAdvice` global converte exceções de domínio em `ProblemDetail`:

```jsonc
{
  "type": "about:blank",
  "title": "Invalid status transition",
  "status": 409,
  "detail": "Cannot change status from ENTREGUE to EM_PREPARO",
  "instance": "/api/v1/orders/8f3a.../status"
}
```

Erros de validação (`400`) trazem a lista de campos inválidos em campo de extensão `errors`.

## 6. Segurança

- Senha com BCrypt, força 10. Hash nunca aparece em log nem em DTO de resposta.
- JWT assinado com par RSA gerado em memória no boot, emitido por `NimbusJwtEncoder` e validado
  por `JwtDecoder` do `oauth2-resource-server`. Nenhuma chave privada é commitada.
  Consequência documentada no README: reiniciar a aplicação invalida os tokens emitidos.
- Claims: `sub` = id do usuário, `email`, `exp` = 1 hora.
- `SessionCreationPolicy.STATELESS`. CSRF desabilitado (API sem cookie de sessão).
- Rotas públicas: `/api/v1/auth/**`, `/swagger-ui/**`, `/v3/api-docs/**`. Todo o resto exige
  autenticação.
- Login com e-mail inexistente e login com senha errada retornam a **mesma** resposta `401`
  genérica, para não revelar quais e-mails estão cadastrados.

## 7. Estrutura de pacotes

Package-by-feature. Sem par `interface` + `Impl` quando existe uma só implementação.

```
src/main/java/com/foody/delivery/
├─ FoodyDeliveryApplication.java
├─ config/
│  ├─ SecurityConfig.java          # filter chain, BCrypt, JwtDecoder/JwtEncoder
│  ├─ JwtKeyConfig.java            # gera par RSA no boot
│  └─ OpenApiConfig.java
├─ shared/
│  ├─ ApiExceptionHandler.java     # @RestControllerAdvice → ProblemDetail
│  └─ exception/                   # NotFoundException, ConflictException, ...
├─ auth/
│  ├─ AuthController.java
│  ├─ AuthService.java
│  ├─ TokenService.java
│  └─ dto/
├─ user/
│  ├─ User.java
│  └─ UserRepository.java
└─ order/
   ├─ OrderController.java
   ├─ OrderService.java
   ├─ OrderRepository.java
   ├─ Order.java · OrderItem.java · Address.java
   ├─ OrderStatus.java
   └─ dto/ + OrderMapper.java
```

## 8. Testes

| Nível | Alvo | Ferramenta |
|---|---|---|
| Unit | `OrderStatus.canTransitionTo` — matriz completa 5×5 | JUnit 5 `@ParameterizedTest` |
| Unit | `OrderService`: total calculado, pedido nasce `RECEBIDO`, transição inválida → `ConflictException` | JUnit + Mockito |
| Integração | auth: register → login → `/orders` com token → `200`; sem token → `401`; token forjado → `401`; e-mail duplicado → `409` | `@SpringBootTest` + MockMvc |
| Integração | pedido: cria → busca por id → lista → avança status → transição ilegal → `409`; id inexistente → `404` | `@SpringBootTest` + MockMvc |

Banco de teste: arquivo SQLite temporário por classe de teste
(`jdbc:sqlite:${java.io.tmpdir}/foody-test-<random>.db`).
**Não** usar `:memory:` — cada conexão do pool abriria um banco vazio distinto.
Flyway roda em teste igual roda em produção, então as migrations ficam cobertas.

Sem Testcontainers: SQLite é embutido.

## 9. README

- Como rodar (`./mvnw spring-boot:run`) e como rodar os testes
- Decisões e seus porquês: SQLite, centavos em `long`, ausência de refresh token, ausência de roles,
  regra de cancelamento
- Sequência de `curl` cobrindo o fluxo completo: register → login → criar pedido → listar →
  buscar por id → avançar status
- Link para o Swagger UI

## 10. Critérios de aceite

1. `./mvnw test` passa.
2. Aplicação sobe com um comando, sem dependência externa (sem Docker, sem banco instalado).
3. Chamar qualquer rota de `/orders` sem token retorna `401`.
4. Fluxo completo do README funciona de ponta a ponta.
5. Toda transição de status ilegal retorna `409` com `ProblemDetail`.
6. Nenhuma resposta da API expõe hash de senha.
