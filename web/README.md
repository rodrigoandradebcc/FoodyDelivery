# Foody Web

Frontend do FoodyDelivery: quadro Kanban de pedidos por status, criação de
pedidos e autenticação (registro/login). Vite + React + TypeScript.

## Pré-requisitos

- Node.js ≥ 20.19 (testado com 20.19.6)
- O backend rodando em `http://localhost:8080` (na raiz do repositório: `./mvnw spring-boot:run`)

## Rodando

```bash
cd web
npm install
npm run dev
```

Abra <http://localhost:5173>. Entre com a conta de demonstração semeada pelo
backend (**demo@foody.dev** / **senha1234**) ou crie a sua em "Crie sua conta" —
o quadro mostra as quatro etapas do pedido; pedidos cancelados ficam na
bandeja "Cancelados" abaixo do quadro (cancelamento é uma saída do fluxo,
não uma etapa).

> **As portas são fixas.** O CORS da API libera exatamente
> `http://localhost:5173` (dev) e `http://localhost:4173` (preview), e o
> `strictPort` do `vite.config.ts` faz o Vite falhar alto em vez de mudar de
> porta em silêncio — uma porta trocada apareceria como falha de autenticação,
> não como um erro de CORS óbvio.

A URL da API pode ser trocada com a variável `VITE_API_BASE_URL`
(padrão: `http://localhost:8080/api/v1`):

```bash
VITE_API_BASE_URL=http://outro-host:8080/api/v1 npm run dev
```

## Testes e build

```bash
npm test        # unitários (vitest): dinheiro em centavos, CEP, ViaCEP, cliente HTTP
npm run build   # typecheck + build de produção
npm run preview # serve o build em http://localhost:4173 (origem liberada no CORS)
npm run lint    # oxlint
```

## Decisões

- **Dinheiro é sempre inteiro em centavos** — nenhuma aritmética de ponto
  flutuante toca valores; formatação/parse centralizados em `src/lib/money.ts`.
- **CANCELADO não é coluna**: o quadro mostra só o pipeline
  `RECEBIDO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE`; cancelados ficam
  numa bandeja recolhível abaixo — cancelar é sair do fluxo.
- **Mobile (<1024px)**: o quadro vira abas de status (filtros) com lista única.
- **Formulários com react-hook-form**: validação no blur e os erros de
  validação da API (`errors[]` do ProblemDetail) voltam para o campo exato.
- **CEP** é exibido com máscara (`01310-100`) e enviado como 8 dígitos puros. Ao completar
  8 dígitos, o endereço é buscado no **ViaCEP** e preenchido automaticamente; se o CEP não
  existir ou o serviço não responder, o formulário continua editável à mão.
- **Sessão**: o token JWT expira em 1h e é invalidado quando o backend
  reinicia; qualquer 401 derruba a sessão para a tela de login com aviso.
- Dependências de runtime: React, react-router, TanStack Query,
  react-hook-form e duas fontes self-hosted — nada além disso.

Os design tokens e as classes compartilhadas vivem em `src/index.css`.
