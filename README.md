# FoodyDelivery

Delivery em duas metades no mesmo repositório:

| | O quê | Onde | Porta |
|---|---|---|---|
| **API** | REST com cadastro/login JWT e pedidos com máquina de estados | raiz (`src/`) | `8080` |
| **Web** | Quadro Kanban de pedidos, criação de pedido, login/registro | [`web/`](web/README.md) | `5173` |

**API:** Java 21 · Spring Boot 4.1 · SQLite · Flyway · Spring Security (resource server) · springdoc/OpenAPI
**Web:** Vite · React 19 · TypeScript · react-router · TanStack Query · react-hook-form

Este README documenta a API; o front tem o seu em [`web/README.md`](web/README.md).

---

## Como rodar

Pré-requisitos: **JDK 21** para a API e **Node.js ≥ 20.19** para o front. Sem Docker, sem
banco instalado, sem serviço externo — o SQLite é embutido e o Maven Wrapper baixa o próprio
Maven. (O bloco de exemplos em "Fluxo completo" usa também `curl` e `python3`, mas isso é do
exemplo, não da aplicação.)

Dá para usar só a API (via Swagger ou curl). Para usar pelo navegador, suba as duas metades
em **dois terminais**, nesta ordem:

```bash
# terminal 1 — API
./mvnw spring-boot:run

# terminal 2 — front
cd web && npm install && npm run dev
```

Depois abra <http://localhost:5173> e entre com a conta de demonstração
(**demo@foody.dev** / **senha1234**).

As portas são fixas: o CORS da API libera exatamente `http://localhost:5173` (dev) e
`http://localhost:4173` (preview), e o Vite roda com `strictPort`. Trocar a porta do front
quebra o login, não o carregamento da página.

### Só a API

```bash
./mvnw spring-boot:run
```

A API sobe em `http://localhost:8080`. Na primeira subida o Flyway cria o banco em
`./data/foody.db` e aplica as migrations. Não há passo de setup manual.

A migration `V3__seed_demo_data.sql` semeia uma conta de demonstração
(**demo@foody.dev** / **senha1234**) e seis pedidos cobrindo todos os status,
para que o quadro apareça populado num checkout novo. Para subir sem os dados
de demonstração, apague esse arquivo antes da primeira execução.

Testes da API:

```bash
./mvnw test
```

Os testes de integração rodam contra um arquivo SQLite temporário **por classe de teste**
(nunca `:memory:`, nunca `./data/foody.db`), com as mesmas migrations Flyway de produção.

### Só o front

O front precisa da API no ar para qualquer tela além do login. Comandos, variáveis de
ambiente e decisões de UI: [`web/README.md`](web/README.md).

```bash
cd web
npm install
npm run dev       # http://localhost:5173
npm test          # unitários (vitest)
npm run build     # typecheck + build de produção
```

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

Parâmetros da listagem, todos opcionais: `status` (um valor do enum; ausente = sem filtro),
`page` (padrão `0`, mínimo `0`) e `size` (**padrão `20`**, mínimo `1`, **máximo `100`**).
Fora desses limites a resposta é `400` com o parâmetro apontado na extensão `errors`. O teto
de `100` existe porque `GET /orders` custa `1 + N + 1` queries por página (ver limitação 1):
sem ele, `?size=1000000` seria um vetor de exaustão de recursos.

Regras de cadastro que valem conhecer antes do primeiro `POST /auth/register`: `name` até
120 caracteres, `email` válido e único, e **`password` entre 8 e 72 caracteres** (o teto de
72 é do BCrypt, e é medido em *bytes* — ver "Decisões"). Senha curta demais devolve `400`
com o campo apontado na extensão `errors`.

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

O bloco abaixo roda de ponta a ponta se colado inteiro no `bash`/`zsh` — os passos 2 e 3
guardam o token e o id do pedido em variáveis, então não há nada para editar à mão. Além do
`curl`, usa `python3` (só para extrair um campo do JSON; qualquer outro extrator serve).

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
#    Guarda o id do pedido em $ID para os passos seguintes.
ID=$(curl -s -X POST http://localhost:8080/api/v1/orders \
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
  }' | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo "pedido criado: $ID"

# 4. Listar (paginado; filtro opcional ?status=RECEBIDO)
curl -s "http://localhost:8080/api/v1/orders?page=0&size=10" \
  -H "Authorization: Bearer $TOKEN"

# 5. Buscar por id
curl -s "http://localhost:8080/api/v1/orders/$ID" -H "Authorization: Bearer $TOKEN"

# 6. Avançar status (RECEBIDO → EM_PREPARO)
curl -s -X PATCH "http://localhost:8080/api/v1/orders/$ID/status" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status": "EM_PREPARO"}'

# 7. Transição ilegal (EM_PREPARO → ENTREGUE) → 409 ProblemDetail
curl -s -X PATCH "http://localhost:8080/api/v1/orders/$ID/status" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status": "ENTREGUE"}'
# {"detail":"Cannot change status from EM_PREPARO to ENTREGUE",
#  "instance":"/api/v1/orders/<id>/status","status":409,
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
2. **Enumeração de e-mails: mitigada no login, aberta no cadastro.** `POST /login`
   devolve o mesmo corpo `401` byte a byte para e-mail inexistente e para senha errada, e
   os dois caminhos executam um BCrypt de verdade (há um hash dummy justamente para o
   caso "usuário não encontrado"), então nem o tempo de resposta distingue os casos. Isso
   é defesa em profundidade — **não** torna a API não-enumerável: `POST /register` devolve
   `409` com o e-mail ecoado no `detail` (`"An account with e-mail X already exists"`), o
   que é um oráculo de enumeração completo. Fechar isso exigiria um fluxo de cadastro por
   confirmação de e-mail, fora do escopo.
3. **Os `401` do filtro de segurança têm corpo vazio, não `ProblemDetail`.** Token
   ausente ou malformado é rejeitado pelo resource server *antes* do Spring MVC, então a
   resposta é `401` com header `WWW-Authenticate: Bearer` e `Content-Length: 0`. Só os
   `401` levantados dentro da aplicação (login com credenciais inválidas) passam pelo
   `@RestControllerAdvice` e carregam corpo RFC 7807. É uma inconsistência real do
   contrato de erro; uniformizá-la exigiria um `AuthenticationEntryPoint` customizado.
4. **O Swagger UI mostra cadeado em `/auth/register` e `/auth/login`** mesmo sendo rotas
   públicas, porque o esquema bearer é declarado como requisito **global** no
   `OpenApiConfig`. Cosmético: as rotas continuam abertas.
5. **`/v3/api-docs` e o Swagger UI ficam habilitados incondicionalmente.** Ótimo para
   avaliação, errado para produção — lá seriam desligados por profile
   (`springdoc.api-docs.enabled=false`).
6. **As mensagens de validação (`400`) saem no idioma do locale padrão da JVM.** Numa
   máquina em pt-BR aparecem como `"deve ser maior que ou igual à 0"`; noutra, em inglês.
   Vem do bundle padrão do Hibernate Validator; mensagens fixas exigiriam
   `message = "..."` em cada constraint.

### Nota para quem for mexer no código

`OrderController.list` recebe os filtros como um **objeto** (`ListQuery`) em vez de três
`@RequestParam` soltos. Isso é intencional: `OrderService.list` passa `page`/`size` direto
para `PageRequest.of`, que lança `IllegalArgumentException` para `page < 0` ou `size < 1`, e
o `ApiExceptionHandler` **não** trata essa exceção (de propósito, para que bugs internos
continuem `500`). Com `@RequestParam`s, `?page=-1` seria um `500`. Ligar `@Validated` +
`@Min` nos params só trocaria a falha por `ConstraintViolationException`, que também não é
tratada — `500` de novo. Bindando num objeto, a falha vira
`MethodArgumentNotValidException`, que o handler já converte no `400` padrão com a extensão
`errors`.

O parâmetro carrega duas anotações, e **elas não têm o mesmo peso** — o que vale é o binding
como objeto, não a anotação `@ModelAttribute`:

- **`@ModelAttribute` não é load-bearing.** O `ServletModelAttributeMethodProcessor` de
  último recurso do Spring é registrado com `annotationNotRequired = true`, então ele pega
  esse parâmetro (não-simples) e respeita o `@Valid` com ou sem a anotação. Comprovado por
  experimento: removendo `@ModelAttribute`, a suíte inteira continua passando,
  incluindo os três testes de validação da listagem. Ela fica no código só por deixar a
  intenção explícita.
- **`@ParameterObject` é a que quebra em silêncio se sumir.** Ela não afeta o binding, só o
  documento OpenAPI: sem ela o springdoc documenta o record como um único parâmetro opaco
  `query` e o Swagger UI renderiza uma caixa inutilizável no lugar dos três campos. O
  runtime continua funcionando igual — nada além do spec gerado denuncia. Removendo,
  `SwaggerIntegrationTest` falha com `parameters.length() expected:<3> but was:<1>`.

Ou seja: pode-se remover `@ModelAttribute` sem quebrar nada; trocar o objeto por
`@RequestParam`s, ou remover `@ParameterObject`, quebra.

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

O front espelha essa organização por feature:

```
web/src
├── api/                cliente HTTP tipado (request, ApiError/ProblemDetail) e endpoints
├── auth/               AuthProvider, useAuth, RequireAuth
├── components/         AppShell (header + Outlet)
├── features/orders/    BoardPage, Column, OrderCard, CanceledTray, MobileBoard,
│                       NewOrderPage, statusMeta, useOrders
├── lib/                money (centavos inteiros), cep, time, useMediaQuery
├── pages/              LoginPage, RegisterPage
└── index.css           design tokens e classes compartilhadas
```

## Testes

**API — 111 testes**, todos verdes (`./mvnw test`): a matriz 5×5 completa da máquina de estados,
validação de DTOs, `OrderService` e `AuthService` com Mockito, e integração ponta a ponta
de auth, pedidos, persistência, segurança e OpenAPI sobre SQLite em arquivo temporário.

**Web — 17 testes** (`cd web && npm test`): dinheiro em centavos (incluindo os casos em que
um round-trip por float perderia um centavo), máscara/strip de CEP, e o cliente HTTP contra
as duas formas de 401 da API (filtro do Spring Security com corpo vazio × ProblemDetail de
login inválido). `npm run build` roda o typecheck junto.
