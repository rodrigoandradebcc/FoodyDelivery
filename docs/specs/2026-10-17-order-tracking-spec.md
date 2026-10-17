# Spec: Sistema de Rastreamento de Pedidos de Delivery

Versão 1 — 2026-10-17. Escrita a partir do enunciado do desafio, sem consulta à implementação existente.

## Como ler esta spec

- **[DESAFIO]** — exigido pelo enunciado, ou consequência direta dele pela regra de cobertura (todo requisito de backend tem contrapartida no front). Desvio aqui é falha.
- **[DECISÃO]** — escolha concreta desta spec em um ponto que o enunciado deixa livre. Desvio aqui é divergência a justificar, não falha do desafio.
- Cada requisito tem um ID estável (`AUTH-xx`, `ORD-xx`, `ERR-xx`, `PER-xx`, `FE-xx`, `NFR-xx`) e um critério de aceite verificável.
- "Dado / quando / então" aparece só onde há comportamento.
- A spec descreve o contrato observável (HTTP, telas, dados). Não prescreve pacotes, classes nem bibliotecas internas.

## Objetivo

Uma versão simplificada de um sistema de rastreamento de pedidos de delivery: usuários se cadastram, fazem login e, autenticados, criam pedidos, acompanham o status deles e atualizam esse status ao longo do ciclo de entrega.

**Usuário:** operador do delivery, autenticado. Todos os operadores enxergam e operam todos os pedidos.

**Sucesso:** todos os requisitos [DESAFIO] atendidos e verificáveis pelos critérios de aceite abaixo.

## Stack obrigatória

| ID | Requisito | Tipo |
|---|---|---|
| NFR-01 | Back-end é uma API REST em Java com Spring Boot. | [DESAFIO] |
| NFR-02 | Persistência em SQLite ou banco similar. | [DESAFIO] |
| NFR-03 | Front-end é uma aplicação React. | [DESAFIO] |

---

## 1. Autenticação (back-end)

| ID | Requisito | Tipo |
|---|---|---|
| AUTH-01 | Cadastro de usuário com nome, e-mail e senha. | [DESAFIO] |
| AUTH-02 | Login com e-mail e senha. | [DESAFIO] |
| AUTH-03 | Apenas usuários autenticados acessam o sistema: todo endpoint de pedidos exige autenticação. | [DESAFIO] |
| AUTH-04 | A autenticação usa token Bearer (JWT) assinado pelo servidor, sem sessão no servidor, com validade de 1 hora e sem refresh token. | [DECISÃO] |
| AUTH-05 | Regras do cadastro: nome obrigatório (1–120 caracteres); e-mail obrigatório, formato válido e único; senha obrigatória com no mínimo 8 caracteres. | [DECISÃO] |
| AUTH-06 | O e-mail é case-insensitive: é armazenado e comparado em minúsculas. | [DECISÃO] |
| AUTH-07 | A senha nunca é armazenada em texto puro (usa hash com salt e algoritmo lento) e nunca aparece em nenhuma resposta. | [DECISÃO] |
| AUTH-08 | Uma falha de login não revela se o e-mail existe: a mesma resposta vale para e-mail inexistente e para senha errada. | [DECISÃO] |
| AUTH-09 | O cadastro não autentica: devolve os dados públicos do usuário (id, nome, e-mail), sem token. | [DECISÃO] |

### Endpoints [DECISÃO]

| Método | Caminho | Autenticado | Sucesso |
|---|---|---|---|
| POST | `/api/v1/auth/register` | não | 201 + `{id, name, email}` |
| POST | `/api/v1/auth/login` | não | 200 + `{accessToken, tokenType: "Bearer", expiresIn: 3600}` |

### Critérios de aceite

- **AUTH-01/05**
  - Dado um corpo válido, quando faço `POST /register`, então recebo 201 e o usuário passa a existir.
  - Dado um e-mail já cadastrado (inclusive com outra capitalização), quando cadastro de novo, então recebo 409.
  - Dado um nome vazio, um e-mail inválido ou uma senha com 7 caracteres, então recebo 400 indicando o campo.
- **AUTH-02/04**
  - Dadas credenciais válidas, quando faço `POST /login`, então recebo 200 com um token que dá acesso aos endpoints de pedidos por 1 hora.
- **AUTH-03**
  - Dada uma requisição a qualquer endpoint de pedidos sem token, com token inválido ou com token expirado, então recebo 401.
- **AUTH-06**
  - Dado um usuário cadastrado como `Ana@X.com`, quando faço login com `ana@x.com`, então recebo 200.
- **AUTH-07**
  - Nenhuma resposta da API contém a senha nem o hash dela.
  - O valor armazenado não é igual à senha enviada.
- **AUTH-08**
  - Login com e-mail inexistente e login com senha errada devolvem o mesmo status (401) e o mesmo corpo.

---

## 2. Pedidos (back-end)

### Modelo do pedido

| Campo | Regra | Tipo |
|---|---|---|
| `id` | Identificador opaco gerado pelo servidor. | [DECISÃO] |
| `customerName` | Nome do cliente; obrigatório, 1–120 caracteres. É texto livre, não um usuário do sistema. | [DESAFIO] cliente / [DECISÃO] regras |
| `items` | Lista com 1 a 100 itens. | [DESAFIO] itens / [DECISÃO] regras |
| `items[].name` | Obrigatório, 1–120 caracteres. | [DECISÃO] |
| `items[].quantity` | Inteiro de 1 a 1000. | [DECISÃO] |
| `items[].unitPriceCents` | Inteiro em centavos, de 0 a 100.000.000. Valores fracionários são rejeitados, nunca arredondados. | [DECISÃO] |
| `deliveryAddress` | Obrigatório: `street`, `number`, `neighborhood`, `city` (cada um 1–120 caracteres); `state` (UF com 2 letras); `zipCode` (8 dígitos); `complement` opcional (até 120 caracteres). | [DESAFIO] endereço / [DECISÃO] regras |
| `totalCents` | Soma de `quantity × unitPriceCents`, calculada pelo servidor. Valor enviado pelo cliente é ignorado. | [DECISÃO] |
| `status` | Um de `RECEBIDO`, `EM_PREPARO`, `SAIU_PARA_ENTREGA`, `ENTREGUE`, `CANCELADO`. | [DESAFIO] |
| `createdAt`, `updatedAt` | Instantes em ISO-8601 UTC, definidos pelo servidor. | [DECISÃO] |

Dinheiro é sempre um inteiro em centavos, nunca ponto flutuante. [DECISÃO]

### Requisitos

| ID | Requisito | Tipo |
|---|---|---|
| ORD-01 | Criar um pedido com cliente, itens e endereço de entrega. | [DESAFIO] |
| ORD-02 | Um pedido novo nasce com status `RECEBIDO`. | [DECISÃO] |
| ORD-03 | Atualizar o status de um pedido entre `RECEBIDO`, `EM_PREPARO`, `SAIU_PARA_ENTREGA`, `ENTREGUE` e `CANCELADO`. | [DESAFIO] |
| ORD-04 | Só são permitidas as transições da tabela abaixo. Qualquer outra, inclusive para o mesmo status, é rejeitada. | [DECISÃO] |
| ORD-05 | Listar todos os pedidos. | [DESAFIO] |
| ORD-06 | A listagem é paginada (página a partir de 0, tamanho padrão 20, máximo 100), ordenada do mais recente para o mais antigo com ordem estável, e informa o total de elementos e de páginas. | [DECISÃO] |
| ORD-07 | A listagem aceita filtro opcional por status. | [DECISÃO] |
| ORD-08 | Buscar um pedido por ID. | [DESAFIO] |
| ORD-09 | Todo usuário autenticado vê e opera todos os pedidos (não há dono). | [DECISÃO] |
| ORD-10 | Duas atualizações de status simultâneas no mesmo pedido não se sobrescrevem em silêncio: uma é aplicada e a outra é rejeitada. | [DECISÃO] |

### Transições de status [DECISÃO]

| De \ Para | EM_PREPARO | SAIU_PARA_ENTREGA | ENTREGUE | CANCELADO |
|---|---|---|---|---|
| RECEBIDO | ✅ | ❌ | ❌ | ✅ |
| EM_PREPARO | ❌ | ✅ | ❌ | ✅ |
| SAIU_PARA_ENTREGA | ❌ | ❌ | ✅ | ✅ |
| ENTREGUE | ❌ | ❌ | ❌ | ❌ |
| CANCELADO | ❌ | ❌ | ❌ | ❌ |

`ENTREGUE` e `CANCELADO` são terminais.

### Endpoints [DECISÃO]

| Método | Caminho | Sucesso |
|---|---|---|
| POST | `/api/v1/orders` | 201 + pedido + header `Location` |
| GET | `/api/v1/orders?page=&size=&status=` | 200 + `{content, page, size, totalElements, totalPages}` |
| GET | `/api/v1/orders/{id}` | 200 + pedido |
| PATCH | `/api/v1/orders/{id}/status` | 200 + pedido atualizado; corpo `{status}` |

### Critérios de aceite

- **ORD-01/02**
  - Dado um corpo válido e um token, quando faço `POST /orders`, então recebo 201 com o pedido em `RECEBIDO`, um `totalCents` correto e um `Location` apontando para o pedido.
  - Dado um pedido sem itens, com mais de 100 itens, com quantidade 0, com preço 49.99, sem endereço ou com UF de 3 letras, então recebo 400 indicando cada campo inválido.
  - Dado um `totalCents` enviado pelo cliente, então ele é ignorado e o servidor usa o próprio cálculo.
- **ORD-03/04**
  - Dado um pedido em `RECEBIDO`, quando faço o PATCH para `EM_PREPARO`, então recebo 200 e `updatedAt` avança.
  - Dado um pedido em `RECEBIDO`, quando faço o PATCH para `ENTREGUE`, então recebo 409 e o status não muda.
  - Dado um pedido `ENTREGUE` ou `CANCELADO`, então qualquer PATCH dá 409.
  - Dado um status fora do enum, então recebo 400 indicando o campo e os valores aceitos.
- **ORD-05/06/07**
  - Dados 25 pedidos, quando faço `GET /orders`, então recebo 20 itens, `totalElements = 25` e `totalPages = 2`.
  - `GET ?page=1` traz os 5 restantes, sem repetir nenhum pedido.
  - `size=101`, `page=-1` ou `status=XYZ` dão 400.
  - `?status=EM_PREPARO` traz só pedidos nesse status.
- **ORD-08**
  - Dado um ID existente, então recebo 200 com o pedido completo.
  - Dado um ID inexistente, então recebo 404.
- **ORD-09**
  - Um pedido criado pelo usuário A aparece na listagem do usuário B e pode ser atualizado por ele.
- **ORD-10**
  - Dados dois PATCH simultâneos e válidos no mesmo pedido, então um recebe 200 e o outro 409.
  - O estado final corresponde ao PATCH que recebeu 200.

---

## 3. Erros (back-end)

| ID | Requisito | Tipo |
|---|---|---|
| ERR-01 | Toda resposta de erro do controller é JSON no formato RFC 7807 (`type`, `title`, `status`, `detail`, `instance`). | [DECISÃO] |
| ERR-02 | Erros de validação (400) trazem `errors: [{field, message}]`, com o caminho completo do campo (ex.: `items[0].quantity`). | [DECISÃO] |
| ERR-03 | Mapeamento de status HTTP: 400 entrada inválida ou JSON malformado; 401 sem autenticação ou credenciais inválidas; 404 recurso ou rota inexistente; 405 método não suportado; 409 conflito (e-mail duplicado, transição inválida, concorrência); 415 content-type não suportado. | [DECISÃO] |
| ERR-04 | Nenhuma resposta de erro expõe stack trace, nome de classe interna ou SQL. | [DECISÃO] |
| ERR-05 | Nenhuma entrada do cliente provoca 500. | [DECISÃO] |

### Critérios de aceite

- Para cada código listado em ERR-03 existe uma requisição que o produz, com corpo no formato ERR-01.
- Nenhum corpo de erro contém `Exception`, `java.`, `org.` nem SQL.

---

## 4. Persistência

| ID | Requisito | Tipo |
|---|---|---|
| PER-01 | Usuários e pedidos são persistidos em SQLite (ou similar). | [DESAFIO] |
| PER-02 | Os dados sobrevivem ao reinício da aplicação. | [DESAFIO] |
| PER-03 | O schema é criado e evoluído por migrações versionadas, aplicadas na subida da aplicação. | [DECISÃO] |
| PER-04 | A unicidade do e-mail é garantida também no banco, não só na aplicação. | [DECISÃO] |

### Critérios de aceite

- Dado um pedido criado, quando reinicio a aplicação, então `GET /orders/{id}` ainda o retorna.
- Dados dois cadastros simultâneos com o mesmo e-mail, então um recebe 201 e o outro 409, nunca 500.

---

## 5. Front-end

Regra de cobertura: cada requisito de back-end do enunciado tem tela ou ação correspondente.

| ID | Requisito | Cobre | Tipo |
|---|---|---|---|
| FE-01 | Tela de cadastro com nome, e-mail e senha. | AUTH-01 | [DESAFIO] |
| FE-02 | Tela de login com e-mail e senha. | AUTH-02 | [DESAFIO] |
| FE-03 | Sem autenticação válida, qualquer tela do sistema redireciona para o login. Telas públicas: login e cadastro. | AUTH-03 | [DESAFIO] |
| FE-04 | Lista de pedidos com o status atual de cada um. | ORD-05 | [DESAFIO] |
| FE-05 | Formulário para criar um pedido novo (cliente, itens, endereço). | ORD-01 | [DESAFIO] |
| FE-06 | Ação para atualizar o status de um pedido. | ORD-03 | [DESAFIO] |
| FE-07 | Visualização de um pedido por ID. | ORD-08 | [DESAFIO] |
| FE-08 | Depois do cadastro, o usuário é autenticado automaticamente e levado à lista de pedidos. | AUTH-09 | [DECISÃO] |
| FE-09 | Botão de logout que descarta o token e volta ao login. | AUTH-04 | [DECISÃO] |
| FE-10 | Se a API responder 401 em qualquer chamada autenticada (ex.: token expirado), a sessão é encerrada e o usuário volta ao login. | AUTH-04 | [DECISÃO] |
| FE-11 | A lista mostra, por pedido: cliente, status (com destaque visual distinto por status), total em R$ e data de criação. Tem paginação e filtro por status. | ORD-06/07 | [DECISÃO] |
| FE-12 | A ação de status oferece só as transições válidas a partir do status atual; pedidos em status terminal não oferecem nenhuma. | ORD-04 | [DECISÃO] |
| FE-13 | O formulário de criação permite adicionar e remover itens, mostra o total calculado em tempo real e valida no cliente as mesmas regras do servidor. | ORD-01 | [DECISÃO] |
| FE-14 | Erros 400 do servidor aparecem junto do campo correspondente; os demais erros aparecem como mensagem legível, nunca como JSON cru. | ERR-01/02 | [DECISÃO] |
| FE-15 | Estados de carregamento, lista vazia e erro de rede são exibidos explicitamente. | — | [DECISÃO] |
| FE-16 | Depois de criar um pedido ou mudar um status, a lista reflete a mudança sem recarregar a página. | ORD-01/03 | [DECISÃO] |
| FE-17 | A visualização por ID é acessível clicando em um pedido da lista e por uma URL própria do pedido. Um ID inexistente mostra "pedido não encontrado". | ORD-08 | [DECISÃO] |
| FE-18 | Valores em dinheiro aparecem em BRL (`R$ 1.234,56`) e datas no fuso local do navegador. | — | [DECISÃO] |

### Critérios de aceite

- **FE-01/08**
  - Dado um cadastro válido, então caio autenticado na lista de pedidos.
  - Dado um e-mail já usado, então vejo o erro junto do campo e-mail.
- **FE-02**
  - Dadas credenciais erradas, então vejo uma mensagem genérica de falha e continuo no login.
- **FE-03/10**
  - Sem token, abrir a URL da lista ou de um pedido me leva ao login.
  - Com um token expirado, a primeira chamada que receber 401 me leva ao login.
- **FE-04/11**
  - Com pedidos existentes, vejo cada um com cliente, status destacado, total em R$ e data.
  - Filtrar por `EM_PREPARO` mostra só esses pedidos.
  - A paginação navega entre as páginas.
- **FE-05/13/16**
  - Ao preencher o formulário e enviar, o pedido aparece na lista em `RECEBIDO`.
  - Quantidade 0 ou UF inválida bloqueiam o envio com mensagem no campo.
- **FE-06/12**
  - Para um pedido `EM_PREPARO`, vejo como opções apenas `SAIU_PARA_ENTREGA` e `CANCELADO`.
  - Ao escolher uma delas, o status novo aparece na lista e no detalhe.
  - Se a API responder 409, vejo a mensagem e o status exibido não muda.
- **FE-07/17**
  - Abrir `/orders/{id}` mostra cliente, itens com subtotal, total, endereço completo, status, criação e última atualização.
  - Um ID inexistente mostra "pedido não encontrado".

---

## 6. Entrega e qualidade

| ID | Requisito | Tipo |
|---|---|---|
| NFR-04 | O README explica como subir back-end e front-end localmente com um comando cada, e indica onde o banco é criado. | [DECISÃO] |
| NFR-05 | Existe documentação navegável da API (ex.: OpenAPI/Swagger). | [DECISÃO] |
| NFR-06 | Testes automatizados no back-end cobrem cada critério de aceite de AUTH, ORD, ERR e PER. | [DECISÃO] |
| NFR-07 | Testes automatizados no front-end cobrem os fluxos de login, proteção de rota, criação de pedido e mudança de status. | [DECISÃO] |
| NFR-08 | Nenhum segredo (como a chave de assinatura do token) fica fixo no código para produção; vem de configuração ou de ambiente. | [DECISÃO] |
| NFR-09 | O front-end acessa a API em outra origem durante o desenvolvimento sem erro de CORS. | [DECISÃO] |

### Critérios de aceite

- Seguindo só o README, numa máquina limpa com os pré-requisitos declarados, os dois lados sobem e o fluxo cadastro → login → criar pedido → mudar status funciona.
- A suíte de testes de cada lado roda com um comando e passa.

---

## Fora do escopo

- Pedidos com dono e perfis de acesso (cliente, entregador, admin).
- Refresh token, recuperação de senha, confirmação de e-mail.
- Edição ou exclusão de pedidos (fora a mudança de status).
- Histórico de mudanças de status.
- Notificações e atualização em tempo real (WebSocket ou polling).
- Pagamento, catálogo de produtos, cálculo de frete.
- Deploy e infraestrutura de produção.

## Questões em aberto

1. **Cancelar depois de `SAIU_PARA_ENTREGA`.** Esta spec permite (entrega frustrada). Se a regra de negócio for "não se cancela pedido em rota", a linha muda para só `ENTREGUE`.
2. **Cadastro autentica?** No back-end o cadastro não devolve token (AUTH-09), e o front faz o login logo em seguida (FE-08). A alternativa é o cadastro já devolver o token.
3. **Busca por ID no front.** FE-17 exige acesso por clique na lista e por URL. Um campo de busca por ID na lista seria um requisito a mais; hoje não está incluído.
