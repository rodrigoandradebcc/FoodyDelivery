# FoodyDelivery API

REST API de delivery: cadastro/login com JWT e gestão de pedidos com máquina de estados.

**Java 21 · Spring Boot 4.1 · SQLite · Flyway · Spring Security (resource server) · springdoc/OpenAPI**

---

## Como rodar

Pré-requisito único: **JDK 21**. Sem Docker, sem banco instalado, sem serviço externo —
o SQLite é embutido e o Maven Wrapper baixa o próprio Maven.

```bash
./mvnw spring-boot:run
```

A API sobe em `http://localhost:8080`. Na primeira subida o Flyway cria o banco em
`./data/foody.db` e aplica as duas migrations. Não há passo de setup manual.

Testes:

```bash
./mvnw test
```

Os testes de integração rodam contra um arquivo SQLite temporário **por classe de teste**
(nunca `:memory:`, nunca `./data/foody.db`), com as mesmas migrations Flyway de produção.

---

## Swagger

- UI: <http://localhost:8080/swagger-ui/index.html>
- OpenAPI JSON: <http://localhost:8080/v3/api-docs>

Ambos são públicos. Use o botão **Authorize** com o `accessToken` devolvido pelo login
(cole apenas o token, sem o prefixo `Bearer`).

---

## Endpoints

| Método | Rota | Autenticação | Sucesso |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | pública | `201` |
| `POST` | `/api/v1/auth/login` | pública | `200` |
| `POST` | `/api/v1/orders` | Bearer JWT | `201` + `Location` |
| `GET` | `/api/v1/orders?status=&page=&size=` | Bearer JWT | `200` |
| `GET` | `/api/v1/orders/{id}` | Bearer JWT | `200` |
| `PATCH` | `/api/v1/orders/{id}/status` | Bearer JWT | `200` |

Erros seguem **RFC 7807 (`application/problem+json`)**: `400` validação (com a extensão
`errors`, um objeto por campo inválido), `401` credenciais inválidas, `404` pedido
inexistente, `409` transição de status inválida ou e-mail já cadastrado.

---

## Máquina de estados

```
RECEBIDO           → EM_PREPARO, CANCELADO
EM_PREPARO         → SAIU_PARA_ENTREGA, CANCELADO
SAIU_PARA_ENTREGA  → ENTREGUE
ENTREGUE           → (terminal)
CANCELADO          → (terminal)
```

Qualquer outra transição — inclusive de um estado para ele mesmo — responde `409` com
`ProblemDetail`. São 5 transições legais e **20 ilegais**, todas verificadas contra o
servidor rodando.

---

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

# 7. Transição ilegal (EM_PREPARO → ENTREGUE) → 409 ProblemDetail
curl -s -X PATCH http://localhost:8080/api/v1/orders/<ID>/status \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status": "ENTREGUE"}'
# {"detail":"Cannot change status from EM_PREPARO to ENTREGUE",
#  "instance":"/api/v1/orders/<ID>/status","status":409,
#  "title":"Invalid status transition"}

# 8. Sem token → 401
curl -si http://localhost:8080/api/v1/orders
```

---

## Decisões e porquês

**SQLite.** Escolhido para dar setup zero a quem avalia: clonar e rodar, sem subir
container nem instalar banco. Isso cobra um preço, e o preço foi pago explicitamente:

- **Dinheiro em `long` de centavos** (`unit_price_cents`, `total_cents`). O SQLite não tem
  `DECIMAL` real — uma coluna declarada assim recebe afinidade `NUMERIC` e acaba
  armazenando ponto flutuante, que perde centavos. `double`/`float` são proibidos para
  dinheiro no projeto; inteiro de centavos é exato por construção.
- **UUID como `varchar(36)` e datas como texto ISO-8601.** O SQLite não tem tipo nativo
  para nenhum dos dois. Como o ISO-8601 ordena lexicograficamente na mesma ordem
  cronológica, `ORDER BY created_at` funciona sem conversão.
- **`journal_mode=WAL` + `busy_timeout=5000`** na URL de conexão — o SQLite aceita um
  escritor por vez; o WAL evita que leituras bloqueiem a escrita e o timeout evita
  `SQLITE_BUSY` imediato sob concorrência.
- **Schema é do Flyway, não do Hibernate** (`ddl-auto: validate`). O Hibernate só valida
  que o mapeamento bate com o schema; nunca altera o banco. Migrations são aditivas,
  porque o `ALTER TABLE` do SQLite é limitado.

**`total_cents` é sempre calculado no servidor.** `Order.place` soma os itens. O DTO de
criação **não tem campo de total** — não existe payload capaz de influenciar o valor
gravado. Um pedido também nasce sempre `RECEBIDO`.

**A máquina de estados mora no domínio.** As transições permitidas estão no enum
`OrderStatus` e são impostas pelo agregado `Order.changeStatus`, não pelo controller. Uma
consequência é deliberada: **depois de `SAIU_PARA_ENTREGA` o pedido não pode mais ser
cancelado** — é regra de negócio, não esquecimento.

**JWT com par RSA gerado em memória no boot** (RS256, `sub` = id do usuário, claim
`email`, expiração de 1 hora). Nenhuma chave é commitada nem lida de arquivo.
**Consequência que você vai encontrar: reiniciar a aplicação invalida todos os tokens já
emitidos** — o par de chaves é novo a cada subida. Basta refazer o login.

**Sem refresh token e sem roles.** Ambos são cortes de escopo conscientes: um único tipo
de token, de vida curta; e qualquer usuário autenticado enxerga *todos* os pedidos, não só
os seus. Autorização por dono/perfil não faz parte do escopo deste exercício.

**Senhas com BCrypt(10)**, e a validação limita a senha a 72 *bytes* (não caracteres),
que é o teto real do BCrypt — acima disso o encoder lançaria exceção e viraria um 500.

---

## Limitações conhecidas

Coisas que eu sei que estão aqui. Nenhuma é acidente; todas são dívida assumida no
escopo de um exercício.

1. **`GET /orders` faz `1 + N + 1` queries por página (N+1).** A coleção `items` é
   `EAGER`, então uma listagem de 5 pedidos dispara 7 statements: 1 da página, 5 dos itens
   (uma por pedido) e 1 do `count`. **A paginação em si está correta e acontece no SQL**
   (`... order by created_at desc limit ? offset ?`), não em memória — é um N+1 de
   carregamento de coleção, não paginação quebrada. A correção seria `@BatchSize` ou um
   `@EntityGraph`/`join fetch` com `countQuery` separado.
2. **`size` não tem limite superior.** `?size=1000000` é aceito e responde `200`
   (`?size=0` e `?page=-1` são rejeitados com `400`). Combinado com o N+1 acima, isso é um
   vetor de exaustão de recursos para um usuário **autenticado**. Faltou um teto do tipo
   `@Max(100)`.
3. **Enumeração de e-mails: mitigada no login, aberta no cadastro.** `POST /login`
   devolve o mesmo corpo `401` byte a byte para e-mail inexistente e para senha errada, e
   os dois caminhos executam um BCrypt de verdade (há um hash dummy justamente para o
   caso "usuário não encontrado"), então nem o tempo de resposta distingue os casos. Isso
   é defesa em profundidade — **não** torna a API não-enumerável: `POST /register` devolve
   `409` com o e-mail ecoado no `detail` (`"An account with e-mail X already exists"`), o
   que é um oráculo de enumeração completo. Fechar isso exigiria um fluxo de cadastro por
   confirmação de e-mail, fora do escopo.
4. **Cadastro duplicado sob concorrência pode virar `500` em vez de `409`.** O
   `register` faz *check-then-insert* (`existsByEmail` e depois `save`), que tem janela de
   corrida. A constraint `UNIQUE(email)` garante que **nenhuma conta duplicada é criada**;
   o que degrada é só o status code. O correto seria capturar
   `DataIntegrityViolationException` e traduzir para `409`.
5. **Os `401` do filtro de segurança têm corpo vazio, não `ProblemDetail`.** Token
   ausente ou malformado é rejeitado pelo resource server *antes* do Spring MVC, então a
   resposta é `401` com header `WWW-Authenticate: Bearer` e `Content-Length: 0`. Só os
   `401` levantados dentro da aplicação (login com credenciais inválidas) passam pelo
   `@RestControllerAdvice` e carregam corpo RFC 7807. É uma inconsistência real do
   contrato de erro; uniformizá-la exigiria um `AuthenticationEntryPoint` customizado.
6. **O Swagger UI mostra cadeado em `/auth/register` e `/auth/login`** mesmo sendo rotas
   públicas, porque o esquema bearer é declarado como requisito **global** no
   `OpenApiConfig`. Cosmético: as rotas continuam abertas.
7. **`/v3/api-docs` e o Swagger UI ficam habilitados incondicionalmente.** Ótimo para
   avaliação, errado para produção — lá seriam desligados por profile
   (`springdoc.api-docs.enabled=false`).
8. **As mensagens de validação (`400`) saem no idioma do locale padrão da JVM.** Numa
   máquina em pt-BR aparecem como `"deve ser maior que ou igual à 0"`; noutra, em inglês.
   Vem do bundle padrão do Hibernate Validator; mensagens fixas exigiriam
   `message = "..."` em cada constraint.

### Nota para quem for mexer no código

`OrderController.list` carrega **duas** anotações no mesmo parâmetro, `@ModelAttribute` e
`@ParameterObject`, e cada uma é load-bearing por um motivo diferente:

- `@ModelAttribute` faz a falha de binding virar `MethodArgumentNotValidException` — que o
  handler já converte em `400`. Sem ela, `?page=-1` estoura em `PageRequest.of` e vira
  `500`.
- `@ParameterObject` só afeta o documento OpenAPI: sem ela o springdoc documenta o record
  como um único parâmetro opaco `query` e o Swagger UI renderiza uma caixa inutilizável no
  lugar dos três campos.

Remover qualquer uma delas degrada algo **silenciosamente** (uma em runtime, outra só na
documentação). Não é redundância.

---

## Estrutura

Organização por feature, não por camada técnica:

```
com.foody.delivery
├── auth/       AuthController, AuthService, TokenService, dto/
├── order/      OrderController, OrderService, Order (agregado), OrderStatus,
│               OrderItem, Address, OrderRepository, OrderMapper, dto/
├── user/       User, UserRepository
├── config/     SecurityConfig, JwtKeyConfig, OpenApiConfig
└── shared/     ApiExceptionHandler (RFC 7807), exceções, conversores, validações
```

Migrations em `src/main/resources/db/migration/`.

## Testes

102 testes, todos verdes (`./mvnw test`): a matriz 5×5 completa da máquina de estados,
validação de DTOs, `OrderService` com Mockito, e integração ponta a ponta de auth,
pedidos, persistência, segurança e OpenAPI sobre SQLite em arquivo temporário.
