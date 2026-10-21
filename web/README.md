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
o quadro mostra as quatro etapas do pedido e, separada por um divisor, a
coluna "Cancelado" (cancelamento é uma saída do fluxo, não uma etapa).

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
npm test        # vitest: unitários e fluxos de UI (login, criação, mudança de status)
npm run build   # typecheck + build de produção
npm run preview # serve o build em http://localhost:4173 (origem liberada no CORS)
npm run lint    # oxlint
```

## Decisões

- **Dinheiro é sempre inteiro em centavos** — nenhuma aritmética de ponto
  flutuante toca valores; formatação/parse centralizados em `src/lib/money.ts`.
- **CANCELADO é a última coluna, fora do pipeline**: o quadro mostra
  `RECEBIDO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE` e, depois de um
  divisor tracejado, a coluna "Cancelado" com cartões esmaecidos — cancelar é
  sair do fluxo.
- **Layout "Anil & Páprica"**: um rail lateral (recolhível, com rótulos em
  flyout no hover/foco) e uma faixa anil no topo sobre a qual cada página abre
  com um cabeçalho próprio (`PageHeader`: título + saudação com a data, ou
  status no detalhe). Abaixo de 640px o mesmo rail vira barra superior.
- **Tema claro/escuro**: segue `prefers-color-scheme` do sistema por padrão; o
  botão de alternância (rail e telas de login/cadastro) persiste a escolha em
  `localStorage` e um script no `<head>` a aplica antes da primeira pintura.
  Os dois temas saem dos mesmos tokens.
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
