# FoodyDelivery Web (Kanban) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vite + React + TypeScript frontend in `web/` that lists orders as a status Kanban board, advances/cancels orders through the API's state machine, creates new orders, and handles register/login — against the existing Spring Boot API at `http://localhost:8080/api/v1`.

**Architecture:** SPA with React Router (declarative mode), TanStack Query as the data layer (one query per status column, invalidation after mutations), a single hand-written `fetch` wrapper that understands RFC 7807 ProblemDetail and the API's two 401 shapes, and plain CSS with design tokens (no UI framework). One Java change only: CORS in `SecurityConfig`.

**Tech Stack:** Vite (react-ts template), React 19, `react-router` (v7, declarative mode — confirmed via context7: install `npm i react-router`, import `BrowserRouter`/`Routes`/`Route` from `"react-router"`; `react-router-dom` is legacy), `@tanstack/react-query` v5, `vitest` (dev-only, node environment), `@fontsource-variable/fraunces` + `@fontsource-variable/public-sans` (self-hosted fonts, zero JS). Backend: Spring Boot 4.1.0 / Spring Security 7 (CORS DSL confirmed via context7: `CorsConfigurationSource` bean + `.cors(Customizer.withDefaults())`, unchanged in 7.0).

## Global Constraints

- Backend repo root: `/Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery`. **Do not modify any Java file except `src/main/java/com/foody/delivery/config/SecurityConfig.java` (Task 1). Do not add backend endpoints.**
- The Java suite is **111/111 green** and must stay green: `./mvnw test` → `Tests run: 111, Failures: 0, Errors: 0`.
- Frontend lives entirely in `web/`. API base URL: `http://localhost:8080/api/v1` (overridable via `VITE_API_BASE_URL`).
- Runtime dependencies allowed: `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `@fontsource-variable/fraunces`, `@fontsource-variable/public-sans`. Dev-only additions: `vitest`. **Nothing else** (no axios, no Tailwind, no component library, no form library).
- **All money is integer cents.** Never do floating-point arithmetic on money. All sums are integer additions on cents; formatting/parsing goes through `web/src/lib/money.ts` only.
- `zipCode` is sent as **exactly 8 digits, no mask**. `state` is exactly 2 chars.
- `OrderResponse` has **no customer field** — never design UI that shows an order's customer.
- Two 401 shapes: security-filter 401s have an **empty body** + `WWW-Authenticate: Bearer` header (never call `.json()` unconditionally); login 401s carry a ProblemDetail body. Tokens expire in 1h **and** die on every backend restart — the app must degrade to `/login` with a friendly message, never a raw error.
- 400s carry `errors: [{field, message}]` with nested names like `items[0].quantity`, `deliveryAddress.zipCode` — map them onto inputs, never dump a blob.
- UI language: **pt-BR** (domain, statuses, and backend README are pt-BR).
- Node on this machine: v20.19.6, npm 11.17.0 (satisfies Vite 7's `^20.19.0 || >=22.12.0`).
- Local git repo exists (no remote assumed). Commit at the end of every task; never push.

## Design Decisions (read before any UI task)

### D1 — CANCELADO is an exit, not a column

The board shows exactly the **four pipeline columns**: `RECEBIDO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE`. Cancelled orders live in a **collapsible "Cancelados" tray rendered *below* the board** (a `<details>` strip of dimmed, compact cards, collapsed by default, header shows the count). Rationale: columns in a row read as sequence; a fifth column beside `ENTREGUE` would claim cancellation follows delivery, which is false. Placing cancelled orders *underneath* the pipeline — visually outside the left-to-right flow, de-emphasized, opt-in — states the truth: cancellation is a trapdoor out of the flow, reachable only from `RECEBIDO`/`EM_PREPARO`. Cancelling is a destructive action with inline confirmation; the card leaves its column and the tray count increments.

### D2 — Mobile (<1024px): the board becomes a segmented, single-status list

A 4-column board needs ≥1000px. Below the `1024px` breakpoint the board is replaced (not squeezed) by:
- A **sticky horizontal status tab bar** (scrollable, scroll-snap, each tab ≥44px tall) with the 4 pipeline statuses in flow order plus — after a visible divider and in dimmed style — a fifth **Cancelados** tab. Tabs are *filters*, not stages, so a Cancelados tab tells no domain lie; the divider + dimming still mark it as outside the flow. Each tab shows its live count.
- Below the tabs: a **single full-width column** of the same `OrderCard`s for the selected status.
- Switching is client-side state; the per-status queries are already cached by TanStack Query, so tab switches are instant.
Desktop/mobile switch is a JS render switch via a `matchMedia` hook (`useMediaQuery("(min-width: 1024px)")`), not CSS-hiding both trees (avoids double-fetching and double DOM).

### D3 — Aesthetic direction: "kitchen pass" — warm paper, ink, tomato

(from frontend-design skill: commit to one distinctive direction; avoid Inter/purple-gradient AI defaults)
- Feel: a restaurant expedite line — order tickets on warm paper. Light theme only, deliberately committed (one polished theme over two mediocre ones).
- Type: **Fraunces Variable** (display serif — brand, page titles, column headers) over **Public Sans Variable** (UI/body). Money and order IDs in the `ui-monospace` system stack with `font-variant-numeric: tabular-nums`.
- Color tokens (all pairs verified ≥4.5:1 for text): paper `#F7F2E9`, surface `#FFFFFF`, ink `#221E19`, soft ink `#5C564C`, line `#E2D9C8`, accent (tomato) `#BC3908` with white text (≈5.6:1).
- Status hues (chip = dark ink-on-tint, column gets a 3px top border in the hue): RECEBIDO blue `#1D5FBF`/`#EAF1FC`, EM_PREPARO amber `#7A4E00`/`#FBF0DC`, SAIU_PARA_ENTREGA teal `#0E6B63`/`#E0F2EF`, ENTREGUE green `#196B34`/`#E4F3E7`, CANCELADO gray `#5F594F`/`#ECE7DE`. Status is never conveyed by color alone — every chip has an SVG icon + text label (ui-ux-pro-max `color-not-only`, `no-emoji-icons`).
- Motion: column cards stagger in at 30ms/card, 180ms ease-out, `transform`/`opacity` only, fully disabled under `prefers-reduced-motion` (ui-ux-pro-max §7).

### D4 — Data-layer choices

(from vercel-react-best-practices skill)
- One query **per status column** (`["orders", status]`, `size=100`) — the 4–5 queries fire in parallel (`async-parallel`; each `Column` owns its query, no waterfall through a parent). `refetchInterval: 15000` keeps statuses fresh. If `totalElements > content.length`, the column footer says `+N não exibidos` (page 0 of size 100 is plenty for a take-home; honest about truncation).
- Mutations invalidate `["orders"]` on settle. A 409 on advance/cancel shows a toast ("Transição inválida — o quadro foi atualizado.") and the invalidation self-heals the board.
- TanStack Query is the single allowed "data layer" dependency: it buys request dedup (`client-swr-dedup`), caching that makes mobile tab-switching free, and mutation invalidation — hand-rolling those would be more code than the library.

---

### Task 1: CORS in `SecurityConfig` (the only Java change)

**Files:**
- Modify: `src/main/java/com/foody/delivery/config/SecurityConfig.java`

**Interfaces:**
- Consumes: nothing.
- Produces: browser-visible API for origin `http://localhost:5173` (Vite dev) and `http://localhost:4173` (Vite preview). Every frontend task depends on this.

**Skills:** none of the four design skills (backend task). Do not touch any other Java file.

Facts driving the code: the app is a stateless Bearer-token API — credentials mode is **not** used (no cookies), so `allowCredentials` stays false and we still scope origins explicitly (never `*` with credentials). The browser must be able to read the `Location` header of `POST /orders` (201) and see `WWW-Authenticate` on filter-level 401s. Spring Security 7 API confirmed via context7 (`/websites/spring_io_spring-security_reference_7_0`): register a `CorsConfigurationSource` bean and enable `.cors(Customizer.withDefaults())`.

- [ ] **Step 1: Confirm baseline is green**

Run: `cd /Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery && ./mvnw -q test`
Expected: `Tests run: 111, Failures: 0, Errors: 0` (BUILD SUCCESS).

- [ ] **Step 2: Edit `SecurityConfig.java`**

The file currently has one `SecurityFilterChain` bean and a `PasswordEncoder` bean. Add `.cors(Customizer.withDefaults())` to the chain and a `CorsConfigurationSource` bean. Full resulting file:

```java
package com.foody.delivery.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Stateless token API: no session cookie, so CSRF protection is not applicable.
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/auth/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        // Dev-only browser clients (Vite dev server and `vite preview`).
        // Bearer tokens travel in the Authorization header, never in cookies,
        // so allowCredentials stays false — and origins are still explicit, not "*".
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(
                "http://localhost:5173",
                "http://localhost:4173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setExposedHeaders(List.of("Location", "WWW-Authenticate"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }
}
```

- [ ] **Step 3: Suite still green**

Run: `./mvnw -q test`
Expected: `Tests run: 111, Failures: 0, Errors: 0`. If any test fails, fix nothing else — revert and re-inspect this file only.

- [ ] **Step 4: Live preflight check**

```bash
./mvnw spring-boot:run > /tmp/foody-boot.log 2>&1 &
BOOT_PID=$!
sleep 25
curl -is -X OPTIONS http://localhost:8080/api/v1/orders \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" | head -15
kill $BOOT_PID
```
Expected: `HTTP/1.1 200` and headers `Access-Control-Allow-Origin: http://localhost:5173`, `Access-Control-Allow-Methods` containing `GET`.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/foody/delivery/config/SecurityConfig.java
git commit -m "feat: allow CORS from Vite dev/preview origins"
```

---

### Task 2: Scaffold `web/` — Vite app, design tokens, app shell

**Files:**
- Create (via scaffold, then edit): `web/package.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`
- Delete scaffold boilerplate: `web/src/App.css`, `web/src/assets/react.svg`, `web/public/vite.svg`

**Interfaces:**
- Consumes: nothing (does not need the backend).
- Produces: the design-token CSS custom properties and shared classes (`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger-ghost`, `.field`, `.card`, `.badge`) that every later UI task uses verbatim; `App.tsx` placeholder that Task 4 replaces.

**Skills:** invoke `frontend-design` (commit to the D3 "kitchen pass" direction — the tokens below implement it; do not swap fonts or palette) and `ui-ux-pro-max` (§1 contrast, §5 spacing scale/4-8px rhythm, §6 semantic tokens — all baked into the token file; keep 44px touch targets on `.btn`).

- [ ] **Step 1: Scaffold**

```bash
cd /Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install react-router @tanstack/react-query @fontsource-variable/fraunces @fontsource-variable/public-sans
```
Expected: installs cleanly on Node 20.19.6. Contingencies: if `create vite` refuses the Node version (a future Vite major), pin `npm create vite@7`. If either `@fontsource-variable/*` package 404s, use `@fontsource/fraunces` + `@fontsource/public-sans` (static weights 400/600/700) and drop the `Variable` suffix from the `font-family` names in Step 3.

- [ ] **Step 2: Replace `web/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Foody — Pedidos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Replace `web/src/index.css` with the design system**

```css
@layer reset, base, components;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  * { margin: 0; }
  html { -webkit-text-size-adjust: 100%; }
  body { min-height: 100dvh; }
  img, svg { display: block; max-width: 100%; }
  input, button, textarea, select { font: inherit; color: inherit; }
  p, h1, h2, h3 { overflow-wrap: break-word; }
}

@layer base {
  :root {
    /* — kitchen pass palette (all text pairs >= 4.5:1) — */
    --bg: #f7f2e9;
    --surface: #ffffff;
    --surface-dim: #efe8da;
    --ink: #221e19;
    --ink-soft: #5c564c;
    --line: #e2d9c8;
    --accent: #bc3908;
    --accent-hover: #a33107;
    --accent-ink: #fff8f0;
    --focus: #1d5fbf;
    --danger: #a4200f;

    /* status hues: -ink on -bg chips; column top borders use -ink */
    --st-recebido-ink: #1d5fbf;      --st-recebido-bg: #eaf1fc;
    --st-em-preparo-ink: #7a4e00;    --st-em-preparo-bg: #fbf0dc;
    --st-saiu-ink: #0e6b63;          --st-saiu-bg: #e0f2ef;
    --st-entregue-ink: #196b34;      --st-entregue-bg: #e4f3e7;
    --st-cancelado-ink: #5f594f;     --st-cancelado-bg: #ece7de;

    /* type */
    --font-display: "Fraunces Variable", Georgia, "Times New Roman", serif;
    --font-body: "Public Sans Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    --text-sm: 0.8125rem;
    --text-base: 0.9375rem;
    --text-lg: clamp(1.0625rem, 1rem + 0.3vw, 1.1875rem);
    --text-xl: clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem);
    --text-2xl: clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem);

    /* 4/8px rhythm */
    --sp-1: 0.25rem; --sp-2: 0.5rem; --sp-3: 0.75rem; --sp-4: 1rem;
    --sp-5: 1.5rem; --sp-6: 2rem; --sp-7: 3rem;

    --r-sm: 6px; --r-md: 10px; --r-lg: 16px;
    --shadow-sm: 0 1px 2px rgb(34 30 25 / 0.08), 0 1px 6px rgb(34 30 25 / 0.05);
    --shadow-md: 0 4px 16px rgb(34 30 25 / 0.12);
  }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: var(--text-base);
    line-height: 1.55;
  }

  h1, h2 { font-family: var(--font-display); font-weight: 600; line-height: 1.15; }
  h1 { font-size: var(--text-2xl); }
  h2 { font-size: var(--text-xl); }

  :focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    border-radius: var(--r-sm);
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@layer components {
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: var(--sp-2);
    min-height: 44px;
    padding: 0 var(--sp-4);
    border: 1px solid transparent;
    border-radius: var(--r-md);
    font-weight: 600; font-size: var(--text-base);
    cursor: pointer;
    touch-action: manipulation;
    transition: background-color 150ms ease-out, transform 150ms ease-out;
    background: none;
  }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .btn-primary { background: var(--accent); color: var(--accent-ink); }
  .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }

  .btn-ghost { border-color: var(--line); color: var(--ink); background: var(--surface); }
  .btn-ghost:hover:not(:disabled) { background: var(--surface-dim); }

  .btn-danger-ghost { color: var(--danger); border-color: transparent; }
  .btn-danger-ghost:hover:not(:disabled) { background: var(--st-cancelado-bg); }

  .btn-sm { min-height: 36px; padding: 0 var(--sp-3); font-size: var(--text-sm); }

  .field { display: flex; flex-direction: column; gap: var(--sp-1); }
  .field > label { font-size: var(--text-sm); font-weight: 600; color: var(--ink-soft); }
  .field > input, .field > select {
    min-height: 44px;
    padding: 0 var(--sp-3);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface);
    font-size: 16px; /* prevents iOS zoom-on-focus */
  }
  .field > input[aria-invalid="true"], .field > select[aria-invalid="true"] {
    border-color: var(--danger);
  }
  .field-error { font-size: var(--text-sm); color: var(--danger); }

  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-sm);
  }

  .badge {
    display: inline-flex; align-items: center; gap: var(--sp-1);
    padding: 2px var(--sp-2);
    border-radius: 999px;
    font-size: var(--text-sm); font-weight: 600;
  }

  .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

  .visually-hidden {
    position: absolute; width: 1px; height: 1px;
    clip-path: inset(50%); overflow: hidden; white-space: nowrap;
  }
}
```

- [ ] **Step 4: Replace `web/src/main.tsx` and `web/src/App.tsx`; delete boilerplate**

`web/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/public-sans";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`web/src/App.tsx` (placeholder — Task 4 replaces it):
```tsx
export default function App() {
  return (
    <main style={{ padding: "var(--sp-6)" }}>
      <h1>Foody</h1>
      <p>Quadro de pedidos — em construção.</p>
    </main>
  );
}
```

Delete `web/src/App.css`, `web/src/assets/react.svg`, `web/public/vite.svg` (and their imports, now gone from the files above).

- [ ] **Step 5: Verify**

Run: `cd web && npm run build`
Expected: `tsc` passes, Vite build succeeds (`✓ built in …`).
Run: `npm run dev &` then `curl -s http://localhost:5173 | grep -o "<title>[^<]*"` → `<title>Foody — Pedidos`; kill the dev server.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "feat(web): scaffold Vite app with kitchen-pass design tokens"
```

---

### Task 3: API layer + money/CEP libs (TDD)

**Files:**
- Create: `web/src/api/types.ts`, `web/src/api/http.ts`, `web/src/api/auth.ts`, `web/src/api/orders.ts`
- Create: `web/src/lib/money.ts`, `web/src/lib/cep.ts`, `web/src/lib/time.ts`
- Test: `web/src/lib/money.test.ts`, `web/src/lib/cep.test.ts`, `web/src/api/http.test.ts`
- Modify: `web/vite.config.ts`, `web/package.json` (add vitest + `test` script)

**Interfaces:**
- Consumes: nothing from other tasks (pure TS; backend not required for tests).
- Produces (used verbatim by Tasks 4–7):
  - `types.ts`: `OrderStatus`, `ORDER_STATUSES`, `FieldError {field, message}`, `ProblemDetail`, `RegisterRequest`, `UserResponse`, `LoginRequest`, `LoginResponse`, `OrderItem {productName, unitPriceCents, quantity}`, `DeliveryAddress`, `CreateOrderRequest`, `OrderResponse`, `PageResponse<T>`
  - `http.ts`: `class ApiError extends Error { status: number; problem: ProblemDetail | null; get fieldErrors(): FieldError[] }`, `request<T>(path, init?)`, `setTokenProvider(fn: () => string | null)`, `setOnUnauthorized(fn: () => void)`
  - `auth.ts`: `register(req: RegisterRequest): Promise<UserResponse>`, `login(req: LoginRequest): Promise<LoginResponse>`
  - `orders.ts`: `listOrders(params: {status?: OrderStatus; page?: number; size?: number}): Promise<PageResponse<OrderResponse>>`, `createOrder(req: CreateOrderRequest): Promise<void>`, `updateOrderStatus(id: string, status: OrderStatus): Promise<OrderResponse>`
  - `money.ts`: `formatCentsBRL(cents: number): string`, `parseBRLToCents(input: string): number | null`
  - `cep.ts`: `stripCep(input: string): string`, `maskCep(digits: string): string`
  - `time.ts`: `formatRelative(iso: string): string`

**Skills:** invoke `vercel-react-best-practices` (`js-early-exit`, `js-hoist-regexp`; the module-level token-provider indirection keeps React state out of the fetch layer). No visual skill needed — no UI in this task.

- [ ] **Step 1: Add vitest**

```bash
cd web && npm install -D vitest
```
Add to `web/package.json` scripts: `"test": "vitest run"`.
Replace `web/vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "node" },
});
```

- [ ] **Step 2: Write failing tests for money and cep**

`web/src/lib/money.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatCentsBRL, parseBRLToCents } from "./money";

describe("formatCentsBRL", () => {
  it("formats integer cents as BRL", () => {
    expect(formatCentsBRL(123456)).toBe("R$ 1.234,56");
    expect(formatCentsBRL(5)).toBe("R$ 0,05");
    expect(formatCentsBRL(0)).toBe("R$ 0,00");
    expect(formatCentsBRL(100)).toBe("R$ 1,00");
  });
});

describe("parseBRLToCents", () => {
  it("parses pt-BR money strings into integer cents", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("R$ 12,50")).toBe(1250);
    expect(parseBRLToCents("12")).toBe(1200);
    expect(parseBRLToCents("0,5")).toBe(50);
  });
  it("rejects garbage", () => {
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("")).toBeNull();
    expect(parseBRLToCents("1,2,3")).toBeNull();
    expect(parseBRLToCents("-5")).toBeNull();
  });
});
```

`web/src/lib/cep.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { maskCep, stripCep } from "./cep";

describe("cep", () => {
  it("strips everything but digits, capped at 8", () => {
    expect(stripCep("01310-100")).toBe("01310100");
    expect(stripCep("01310100999")).toBe("01310100");
    expect(stripCep("abc")).toBe("");
  });
  it("masks progressively", () => {
    expect(maskCep("01310100")).toBe("01310-100");
    expect(maskCep("0131")).toBe("0131");
    expect(maskCep("013101")).toBe("01310-1");
    expect(maskCep("")).toBe("");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test`
Expected: FAIL — modules `./money` / `./cep` not found.

- [ ] **Step 4: Implement the libs (integer math only)**

`web/src/lib/money.ts`:
```ts
/**
 * Money is ALWAYS integer cents. No float arithmetic anywhere:
 * formatting splits with integer division/modulo; parsing works on strings.
 */
const PARSE_RE = /^\d+(\.\d{1,2})?$/;

export function formatCentsBRL(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.trunc(abs / 100).toLocaleString("pt-BR");
  const centavos = String(abs % 100).padStart(2, "0");
  return `${sign}R$ ${reais},${centavos}`;
}

export function parseBRLToCents(input: string): number | null {
  // "1.234,56" | "R$ 12,50" | "12" | "0,5" → integer cents
  const cleaned = input.trim().replace(/[R$\s.]/g, "").replace(",", ".");
  if (!PARSE_RE.test(cleaned)) return null;
  const [reais, frac = ""] = cleaned.split(".");
  return Number(reais) * 100 + Number((frac + "00").slice(0, 2));
}
```

`web/src/lib/cep.ts`:
```ts
export function stripCep(input: string): string {
  return input.replace(/\D/g, "").slice(0, 8);
}

export function maskCep(digits: string): string {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
```

`web/src/lib/time.ts`:
```ts
const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatRelative(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return rtf.format(diffH, "hour");
  return rtf.format(Math.round(diffH / 24), "day");
}
```

- [ ] **Step 5: Run lib tests to verify pass**

Run: `npm test`
Expected: money + cep suites PASS (http suite doesn't exist yet).

- [ ] **Step 6: Write failing http tests**

`web/src/api/http.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, request, setOnUnauthorized, setTokenProvider } from "./http";

afterEach(() => {
  vi.unstubAllGlobals();
  setOnUnauthorized(() => {});
  setTokenProvider(() => null);
});

describe("request", () => {
  it("survives the filter-chain 401 (EMPTY body, no JSON) and fires onUnauthorized", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(null, { status: 401, headers: { "WWW-Authenticate": "Bearer" } }),
    ));
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);

    const err = await request("/orders").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.problem).toBeNull(); // did NOT try to parse a body
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does NOT fire onUnauthorized for auth-less calls (login failure)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ title: "Unauthorized", detail: "Credenciais inválidas", status: 401 }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } }),
    ));
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);

    const err = await request("/auth/login", { method: "POST", body: {}, auth: false }).catch((e) => e);
    expect(err.status).toBe(401);
    expect(err.problem?.detail).toBe("Credenciais inválidas");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("parses RFC 7807 field errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        title: "Bad Request", status: 400,
        errors: [{ field: "deliveryAddress.zipCode", message: "tamanho deve ser 8" }],
      }), { status: 400, headers: { "Content-Type": "application/problem+json" } }),
    ));
    const err = await request("/orders", { method: "POST", body: {} }).catch((e) => e);
    expect(err.fieldErrors).toEqual([{ field: "deliveryAddress.zipCode", message: "tamanho deve ser 8" }]);
  });

  it("attaches the Bearer token and parses JSON on success", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setTokenProvider(() => "tok123");

    await expect(request("/orders")).resolves.toEqual({ ok: true });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("returns undefined for a 201 with no JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(null, { status: 201, headers: { Location: "/api/v1/orders/abc" } }),
    ));
    await expect(request("/orders", { method: "POST", body: {} })).resolves.toBeUndefined();
  });
});
```

Run: `npm test` → Expected: FAIL, `./http` not found.

- [ ] **Step 7: Implement types + http + endpoint modules**

`web/src/api/types.ts`:
```ts
export type OrderStatus =
  | "RECEBIDO"
  | "EM_PREPARO"
  | "SAIU_PARA_ENTREGA"
  | "ENTREGUE"
  | "CANCELADO";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE", "CANCELADO",
] as const;

export interface FieldError { field: string; message: string; }

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
}

export interface RegisterRequest { name: string; email: string; password: string; }
export interface UserResponse { id: string; name: string; email: string; }
export interface LoginRequest { email: string; password: string; }
export interface LoginResponse { accessToken: string; tokenType: "Bearer"; expiresIn: number; }

export interface OrderItem { productName: string; unitPriceCents: number; quantity: number; }

export interface DeliveryAddress {
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;   // exactly 2 chars
  zipCode: string; // exactly 8 digits, no mask
}

export interface CreateOrderRequest { items: OrderItem[]; deliveryAddress: DeliveryAddress; }

export interface OrderResponse {
  id: string;
  status: OrderStatus;
  totalCents: number;
  items: OrderItem[];
  deliveryAddress: DeliveryAddress;
  createdAt: string;
  updatedAt: string;
  // NOTE: the API never returns the order's customer. Do not add UI for it.
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
```

`web/src/api/http.ts`:
```ts
import type { FieldError, ProblemDetail } from "./types";

const BASE: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetail | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `Erro HTTP ${status}`);
    this.name = "ApiError";
  }
  get fieldErrors(): FieldError[] {
    return this.problem?.errors ?? [];
  }
}

/** Wired by the auth layer; the fetch layer never imports React. */
let tokenProvider: () => string | null = () => null;
let unauthorizedHandler: () => void = () => {};

export function setTokenProvider(fn: () => string | null): void { tokenProvider = fn; }
export function setOnUnauthorized(fn: () => void): void { unauthorizedHandler = fn; }

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** false for /auth/* calls: no Bearer header, and a 401 means bad credentials, not an expired session. */
  auth?: boolean;
}

export async function request<T = unknown>(
  path: string,
  { method = "GET", body, auth = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, {
      title: "API indisponível",
      detail: `Não foi possível conectar à API em ${BASE}. O backend está rodando?`,
    });
  }

  if (!res.ok) {
    // Two 401 shapes: the security filter returns an EMPTY body (only a
    // WWW-Authenticate header) — .json() would throw. ProblemDetail bodies
    // are parsed only when the Content-Type says there is JSON.
    let problem: ProblemDetail | null = null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("json")) {
      problem = await res.json().catch(() => null);
    }
    if (res.status === 401 && auth) unauthorizedHandler();
    throw new ApiError(res.status, problem);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return undefined as T; // e.g. 201 Created, empty body
  return (await res.json()) as T;
}
```

`web/src/api/auth.ts`:
```ts
import { request } from "./http";
import type { LoginRequest, LoginResponse, RegisterRequest, UserResponse } from "./types";

export function register(req: RegisterRequest): Promise<UserResponse> {
  return request<UserResponse>("/auth/register", { method: "POST", body: req, auth: false });
}

export function login(req: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", { method: "POST", body: req, auth: false });
}
```

`web/src/api/orders.ts`:
```ts
import { request } from "./http";
import type { CreateOrderRequest, OrderResponse, OrderStatus, PageResponse } from "./types";

export function listOrders(params: {
  status?: OrderStatus;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<OrderResponse>> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.page !== undefined) q.set("page", String(params.page));
  if (params.size !== undefined) q.set("size", String(params.size));
  const qs = q.toString();
  return request<PageResponse<OrderResponse>>(`/orders${qs ? `?${qs}` : ""}`);
}

/** 201 + Location header; the body is not part of the contract, so we ignore it. */
export async function createOrder(req: CreateOrderRequest): Promise<void> {
  await request("/orders", { method: "POST", body: req });
}

export function updateOrderStatus(id: string, status: OrderStatus): Promise<OrderResponse> {
  return request<OrderResponse>(`/orders/${id}/status`, { method: "PATCH", body: { status } });
}
```

- [ ] **Step 8: All tests green + build**

Run: `npm test` → Expected: all 3 files PASS (11 tests).
Run: `npm run build` → Expected: success.

- [ ] **Step 9: Commit**

```bash
git add web/src/api web/src/lib web/vite.config.ts web/package.json web/package-lock.json
git commit -m "feat(web): typed API client, ProblemDetail handling, money/CEP libs (TDD)"
```

---

### Task 4: Auth — context, route guard, login and register pages

**Files:**
- Create: `web/src/auth/auth.tsx`, `web/src/pages/LoginPage.tsx`, `web/src/pages/RegisterPage.tsx`, `web/src/pages/auth.css`, `web/src/components/AppShell.tsx`, `web/src/components/appshell.css`
- Modify: `web/src/App.tsx`, `web/src/main.tsx`

**Interfaces:**
- Consumes (Task 3): `login`, `register` from `../api/auth`; `ApiError`, `setTokenProvider`, `setOnUnauthorized` from `../api/http`.
- Produces:
  - `auth.tsx`: `AuthProvider`, `useAuth(): { isAuthenticated: boolean; sessionExpired: boolean; signIn(email: string, password: string): Promise<void>; signOut(): void }`, `RequireAuth` (wrapper route element)
  - `AppShell.tsx`: layout route with header + `<Outlet/>` — Tasks 5–7 render inside it
  - Route map: `/login`, `/register`, and protected `/` (board) and `/orders/new`

**Skills:** invoke `ui-ux-pro-max` (§8 Forms & Feedback: visible labels, error below field, `aria-invalid` + `role="alert"`, validate on blur not keystroke, password show/hide toggle, semantic `type="email"`/`autocomplete`, focus first invalid field) and `frontend-design` (auth screens are the first impression: centered ticket-card on the paper background, Fraunces brand mark, no stock illustration).

- [ ] **Step 1: Auth state**

`web/src/auth/auth.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { login as apiLogin } from "../api/auth";
import { setOnUnauthorized, setTokenProvider } from "../api/http";

const STORAGE_KEY = "foody.auth";

interface StoredAuth { token: string; expiresAt: number; }

function readStoredToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredAuth;
    if (typeof stored.token !== "string" || Date.now() >= stored.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored.token;
  } catch {
    return null;
  }
}

// The fetch layer reads storage directly — valid even before React mounts.
setTokenProvider(readStoredToken);

interface AuthContextValue {
  isAuthenticated: boolean;
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // Expired/invalid token (1h TTL, or backend restarted and rotated its
    // in-memory RSA keypair): drop credentials and fall back to /login
    // with a friendly message instead of a raw error.
    setOnUnauthorized(() => {
      localStorage.removeItem(STORAGE_KEY);
      setToken(null);
      setSessionExpired(true);
    });
    return () => setOnUnauthorized(() => {});
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiLogin({ email, password });
    const stored: StoredAuth = {
      token: res.accessToken,
      expiresAt: Date.now() + res.expiresIn * 1000,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setToken(res.accessToken);
    setSessionExpired(false);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated: token !== null, sessionExpired, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
```

- [ ] **Step 2: App shell and routes**

`web/src/components/AppShell.tsx`:
```tsx
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/auth";
import "./appshell.css";

export default function AppShell() {
  const { signOut } = useAuth();
  return (
    <div className="shell">
      <header className="shell-header">
        <NavLink to="/" className="brand">Foody<span className="brand-dot">.</span></NavLink>
        <nav className="shell-nav" aria-label="Principal">
          <Link to="/orders/new" className="btn btn-primary">Novo pedido</Link>
          <button type="button" className="btn btn-ghost" onClick={signOut}>Sair</button>
        </nav>
      </header>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
```

`web/src/components/appshell.css`:
```css
.shell { min-height: 100dvh; display: flex; flex-direction: column; }

.shell-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--sp-4);
  padding: var(--sp-3) clamp(var(--sp-4), 4vw, var(--sp-6));
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 20;
}

.brand {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
}
.brand-dot { color: var(--accent); }

.shell-nav { display: flex; gap: var(--sp-2); }

.shell-main {
  flex: 1;
  padding: clamp(var(--sp-4), 3vw, var(--sp-6));
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}
```

Replace `web/src/App.tsx`:
```tsx
import { Route, Routes } from "react-router";
import { RequireAuth } from "./auth/auth";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

function BoardPlaceholder() {
  return <p>Quadro de pedidos — chega na Task 5.</p>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<BoardPlaceholder />} />
      </Route>
    </Routes>
  );
}
```

Replace `web/src/main.tsx` (adds router + auth providers):
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/public-sans";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./auth/auth";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 3: Login page**

`web/src/pages/auth.css`:
```css
.auth-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--sp-4);
}

.auth-card {
  width: min(100%, 26rem);
  padding: clamp(var(--sp-5), 5vw, var(--sp-6));
  display: flex; flex-direction: column; gap: var(--sp-4);
}

.auth-brand {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
}
.auth-brand span { color: var(--accent); }

.auth-sub { color: var(--ink-soft); margin-top: calc(-1 * var(--sp-3)); }

.auth-form { display: flex; flex-direction: column; gap: var(--sp-4); }

.auth-alert {
  padding: var(--sp-3);
  border-radius: var(--r-md);
  background: var(--st-cancelado-bg);
  color: var(--danger);
  font-size: var(--text-sm);
}
.auth-alert-info { background: var(--st-recebido-bg); color: var(--st-recebido-ink); }

.auth-alt { font-size: var(--text-sm); color: var(--ink-soft); text-align: center; }
.auth-alt a { color: var(--accent); font-weight: 600; }

.pw-wrap { position: relative; }
.pw-wrap > input { width: 100%; padding-right: 5.5rem; }
.pw-toggle {
  position: absolute; right: var(--sp-2); top: 50%; transform: translateY(-50%);
  border: none; background: none; cursor: pointer;
  color: var(--ink-soft); font-size: var(--text-sm); font-weight: 600;
  min-height: 36px; padding: 0 var(--sp-2);
}
```

`web/src/pages/LoginPage.tsx`:
```tsx
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ApiError } from "../api/http";
import { useAuth } from "../auth/auth";
import "./auth.css";

export default function LoginPage() {
  const { isAuthenticated, sessionExpired, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (err) {
      // The API deliberately returns the same 401 for unknown e-mail and
      // wrong password — mirror that with one generic message.
      setError(
        err instanceof ApiError && err.status === 401
          ? "E-mail ou senha incorretos."
          : err instanceof Error ? err.message : "Erro inesperado.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-brand">Foody<span>.</span></h1>
        <p className="auth-sub">Entre para acompanhar o quadro de pedidos.</p>

        {sessionExpired && (
          <p className="auth-alert auth-alert-info" role="status">
            Sua sessão expirou. Entre novamente.
          </p>
        )}
        {error && <p className="auth-alert" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <div className="pw-wrap">
              <input id="password" type={showPw ? "text" : "password"}
                autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-pressed={showPw}>
                {showPw ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="auth-alt">
          Primeira vez aqui? <Link to="/register">Crie sua conta</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Register page**

`web/src/pages/RegisterPage.tsx` — mirrors LoginPage's structure; extra rules: name ≤120 chars, e-mail ≤180, password 8–72 chars **and ≤72 UTF-8 bytes** (checked with `TextEncoder` — "senha muito longa" can differ from char count with accents/emoji), 409 maps to the e-mail field, 400 `errors[]` map onto fields, success auto-logs-in:

```tsx
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { register } from "../api/auth";
import { ApiError } from "../api/http";
import { useAuth } from "../auth/auth";
import "./auth.css";

const encoder = new TextEncoder();

export default function RegisterPage() {
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Informe seu nome.";
    else if (name.length > 120) errs.name = "Máximo de 120 caracteres.";
    if (!email.trim()) errs.email = "Informe seu e-mail.";
    else if (email.length > 180) errs.email = "Máximo de 180 caracteres.";
    if (password.length < 8) errs.password = "A senha precisa de pelo menos 8 caracteres.";
    else if (password.length > 72 || encoder.encode(password).length > 72)
      errs.password = "Senha muito longa (máximo de 72 caracteres/bytes).";
    return errs;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.getElementById(Object.keys(errs)[0])?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      await signIn(email.trim(), password); // straight to the board
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldErrors({ email: "Este e-mail já está cadastrado." });
        document.getElementById("email")?.focus();
      } else if (err instanceof ApiError && err.fieldErrors.length > 0) {
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) mapped[fe.field] = fe.message;
        setFieldErrors(mapped);
      } else {
        setFormError(err instanceof Error ? err.message : "Erro inesperado.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-brand">Foody<span>.</span></h1>
        <p className="auth-sub">Crie sua conta para registrar pedidos.</p>

        {formError && <p className="auth-alert" role="alert">{formError}</p>}

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" autoComplete="name" maxLength={120} required
              aria-invalid={!!fieldErrors.name}
              value={name} onChange={(e) => setName(e.target.value)} />
            {fieldErrors.name && <span className="field-error" role="alert">{fieldErrors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" maxLength={180} required
              aria-invalid={!!fieldErrors.email}
              value={email} onChange={(e) => setEmail(e.target.value)} />
            {fieldErrors.email && <span className="field-error" role="alert">{fieldErrors.email}</span>}
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <div className="pw-wrap">
              <input id="password" type={showPw ? "text" : "password"}
                autoComplete="new-password" required
                aria-invalid={!!fieldErrors.password}
                aria-describedby="password-hint"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="pw-toggle"
                onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}>
                {showPw ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <span id="password-hint" className="field-error" style={{ color: "var(--ink-soft)" }}>
              Entre 8 e 72 caracteres.
            </span>
            {fieldErrors.password && <span className="field-error" role="alert">{fieldErrors.password}</span>}
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Criando conta…" : "Criar conta"}
          </button>
        </form>

        <p className="auth-alt">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `cd web && npm run build && npm test`
Expected: build succeeds; all tests still green.

Manual smoke (requires backend): start `./mvnw spring-boot:run` (repo root) and `npm run dev` (web/). In a browser at `http://localhost:5173`: unauthenticated visit to `/` redirects to `/login`; register a fresh e-mail (e.g. `dev+$(date +%s)@test.com` / `senha1234`) → lands on the board placeholder; reload keeps you in; `Sair` returns to login; wrong password shows "E-mail ou senha incorretos."; registering the same e-mail again shows the 409 message on the e-mail field. Stop both servers.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat(web): auth context, route guard, login and register pages"
```

---

### Task 5: The Kanban board (desktop) — columns, cards, cancel tray

**Files:**
- Create: `web/src/features/orders/statusMeta.tsx`, `web/src/features/orders/useOrders.ts`, `web/src/features/orders/BoardPage.tsx`, `web/src/features/orders/Column.tsx`, `web/src/features/orders/OrderCard.tsx`, `web/src/features/orders/CanceledTray.tsx`, `web/src/features/orders/board.css`
- Modify: `web/src/App.tsx` (swap placeholder for `BoardPage`), `web/src/main.tsx` (add `QueryClientProvider`)

**Interfaces:**
- Consumes (Task 3): `listOrders`, `updateOrderStatus` from `../../api/orders`; `ApiError` from `../../api/http`; types; `formatCentsBRL`, `formatRelative`.
- Produces (Task 6 relies on these exact names): `STATUS_META`, `PIPELINE`, `NEXT_STATUS`, `ADVANCE_LABEL`, `CAN_CANCEL` from `statusMeta.tsx`; `useOrdersByStatus(status)`, `useStatusMutation(onApiError)` from `useOrders.ts`; `Column({ status, notify })`, `OrderCard({ order, notify })`, `CanceledTray({ notify })` components; `BoardPage` default export.

**Skills:** invoke `frontend-design` (this is the centerpiece screen: ticket-like cards, Fraunces column headers, staggered entrance, controlled density — make it memorable, not a gray CRUD grid), `ui-ux-pro-max` (§2 loading feedback on async buttons, §4 SVG icons never emoji + one primary CTA per card, §7 stagger 30–50ms + transform/opacity only + reduced-motion, §8 confirmation before destructive cancel + empty states + toast with `aria-live`), and `vercel-react-best-practices` (`async-parallel`: each column owns its query so the 4–5 fetches run in parallel; `client-swr-dedup` via TanStack Query; `rerender-no-inline-components`).

- [ ] **Step 1: Status metadata + inline SVG icons**

`web/src/features/orders/statusMeta.tsx`:
```tsx
import type { ReactElement } from "react";
import type { OrderStatus } from "../../api/types";

/* 16px stroke icons — no emoji (ui-ux-pro-max: no-emoji-icons). */
function icon(path: ReactElement) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}

export const STATUS_META: Record<OrderStatus, {
  label: string;
  ink: string;   /* CSS var for text/border */
  bg: string;    /* CSS var for chip/tint background */
  icon: ReactElement;
}> = {
  RECEBIDO: {
    label: "Recebido",
    ink: "var(--st-recebido-ink)", bg: "var(--st-recebido-bg)",
    icon: icon(<><path d="M2 9h3l2 2.5h2L11 9h3" /><path d="M2 9V4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5V9v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9Z" /></>),
  },
  EM_PREPARO: {
    label: "Em preparo",
    ink: "var(--st-em-preparo-ink)", bg: "var(--st-em-preparo-bg)",
    icon: icon(<><path d="M8 2c1.8 1.6 2.6 3 2.6 4.4A2.6 2.6 0 0 1 8 9a2.6 2.6 0 0 1-2.6-2.6C5.4 5 6.2 3.6 8 2Z" /><path d="M4 12.5h8M5 12.5V14M11 12.5V14" /></>),
  },
  SAIU_PARA_ENTREGA: {
    label: "Saiu para entrega",
    ink: "var(--st-saiu-ink)", bg: "var(--st-saiu-bg)",
    icon: icon(<><circle cx="4.5" cy="11.5" r="2" /><circle cx="11.5" cy="11.5" r="2" /><path d="M4.5 11.5 7 6h3l1.5 5.5M7 6H5.5" /></>),
  },
  ENTREGUE: {
    label: "Entregue",
    ink: "var(--st-entregue-ink)", bg: "var(--st-entregue-bg)",
    icon: icon(<><circle cx="8" cy="8" r="6" /><path d="m5.5 8 1.8 1.8L10.8 6.2" /></>),
  },
  CANCELADO: {
    label: "Cancelado",
    ink: "var(--st-cancelado-ink)", bg: "var(--st-cancelado-bg)",
    icon: icon(<><circle cx="8" cy="8" r="6" /><path d="m6 6 4 4M10 6l-4 4" /></>),
  },
};

/** The four pipeline stages, in flow order. CANCELADO is deliberately NOT here — it is an exit, not a stage (see plan §D1). */
export const PIPELINE: readonly OrderStatus[] = [
  "RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE",
] as const;

/** Mirror of the API state machine. The UI must never offer an illegal move. */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  RECEBIDO: "EM_PREPARO",
  EM_PREPARO: "SAIU_PARA_ENTREGA",
  SAIU_PARA_ENTREGA: "ENTREGUE",
  ENTREGUE: null,
  CANCELADO: null,
};

export const ADVANCE_LABEL: Record<OrderStatus, string | null> = {
  RECEBIDO: "Iniciar preparo",
  EM_PREPARO: "Despachar entrega",
  SAIU_PARA_ENTREGA: "Confirmar entrega",
  ENTREGUE: null,
  CANCELADO: null,
};

export const CAN_CANCEL: Record<OrderStatus, boolean> = {
  RECEBIDO: true,
  EM_PREPARO: true,
  SAIU_PARA_ENTREGA: false,
  ENTREGUE: false,
  CANCELADO: false,
};
```

- [ ] **Step 2: Query hooks**

`web/src/features/orders/useOrders.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/http";
import { listOrders, updateOrderStatus } from "../../api/orders";
import type { OrderStatus } from "../../api/types";

/** One query per column → the 4–5 fetches run in parallel (no waterfall). */
export function useOrdersByStatus(status: OrderStatus) {
  return useQuery({
    queryKey: ["orders", status],
    queryFn: () => listOrders({ status, size: 100 }),
    refetchInterval: 15_000,
  });
}

export function useStatusMutation(onApiError: (e: ApiError) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateOrderStatus(id, status),
    onError: (err) => {
      if (err instanceof ApiError) onApiError(err);
    },
    // Success or 409 alike: refetch every column so the board self-heals.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });
}
```

- [ ] **Step 3: OrderCard**

`web/src/features/orders/OrderCard.tsx`:
```tsx
import { useState } from "react";
import type { OrderResponse } from "../../api/types";
import { formatCentsBRL } from "../../lib/money";
import { formatRelative } from "../../lib/time";
import { maskCep } from "../../lib/cep";
import { ADVANCE_LABEL, CAN_CANCEL, NEXT_STATUS } from "./statusMeta";
import { useStatusMutation } from "./useOrders";

export function OrderCard({ order, notify }: { order: OrderResponse; notify: (msg: string) => void }) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const mutation = useStatusMutation((e) => {
    notify(e.status === 409
      ? "Transição inválida — o quadro foi atualizado."
      : e.message);
  });

  const next = NEXT_STATUS[order.status];
  const advanceLabel = ADVANCE_LABEL[order.status];
  const canCancel = CAN_CANCEL[order.status];
  const addr = order.deliveryAddress;
  const [first, ...rest] = order.items;
  const busy = mutation.isPending;

  return (
    <article className="order-card card">
      <header className="order-card-top">
        <span className="mono order-id" title={order.id}>#{order.id.slice(0, 8)}</span>
        <time className="order-time" dateTime={order.createdAt}>{formatRelative(order.createdAt)}</time>
      </header>

      <p className="order-summary">
        {first.quantity}× {first.productName}
        {rest.length > 0 && <span className="order-more"> +{rest.length} {rest.length === 1 ? "item" : "itens"}</span>}
      </p>
      <p className="order-place">{addr.district} · {addr.city}</p>

      <details className="order-details">
        <summary>Detalhes</summary>
        <ul className="order-items">
          {order.items.map((item, i) => (
            <li key={i}>
              <span>{item.quantity}× {item.productName}</span>
              <span className="mono">{formatCentsBRL(item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="order-address">
          {addr.street}, {addr.number}{addr.complement ? ` — ${addr.complement}` : ""}<br />
          {addr.district}, {addr.city} — {addr.state} · CEP {maskCep(addr.zipCode)}
        </p>
      </details>

      <footer className="order-card-bottom">
        <strong className="mono order-total">{formatCentsBRL(order.totalCents)}</strong>
        {(next || canCancel) && (
          confirmingCancel ? (
            <div className="order-actions" role="group" aria-label="Confirmar cancelamento">
              <button type="button" className="btn btn-sm btn-ghost" disabled={busy}
                onClick={() => setConfirmingCancel(false)}>Voltar</button>
              <button type="button" className="btn btn-sm btn-primary order-cancel-confirm" disabled={busy}
                onClick={() => mutation.mutate(
                  { id: order.id, status: "CANCELADO" },
                  { onSettled: () => setConfirmingCancel(false) },
                )}>
                {busy ? "Cancelando…" : "Confirmar cancelamento"}
              </button>
            </div>
          ) : (
            <div className="order-actions">
              {canCancel && (
                <button type="button" className="btn btn-sm btn-danger-ghost" disabled={busy}
                  onClick={() => setConfirmingCancel(true)}>Cancelar</button>
              )}
              {next && advanceLabel && (
                <button type="button" className="btn btn-sm btn-primary" disabled={busy}
                  onClick={() => mutation.mutate({ id: order.id, status: next })}>
                  {busy ? "Salvando…" : advanceLabel}
                </button>
              )}
            </div>
          )
        )}
      </footer>
    </article>
  );
}
```

- [ ] **Step 4: Column, CanceledTray, BoardPage**

`web/src/features/orders/Column.tsx`:
```tsx
import type { OrderStatus } from "../../api/types";
import { STATUS_META } from "./statusMeta";
import { OrderCard } from "./OrderCard";
import { useOrdersByStatus } from "./useOrders";

export function Column({ status, notify }: { status: OrderStatus; notify: (msg: string) => void }) {
  const meta = STATUS_META[status];
  const query = useOrdersByStatus(status);
  const page = query.data;

  return (
    <section className="board-column" style={{ borderTopColor: meta.ink }} aria-label={meta.label}>
      <header className="column-header">
        <span className="badge" style={{ background: meta.bg, color: meta.ink }}>
          {meta.icon} {meta.label}
        </span>
        <span className="column-count mono">{page?.totalElements ?? "…"}</span>
      </header>

      {query.isPending && (
        <div className="column-list" aria-hidden="true">
          <div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" />
        </div>
      )}

      {query.isError && (
        <div className="column-empty">
          <p>Não foi possível carregar.</p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => query.refetch()}>
            Tentar de novo
          </button>
        </div>
      )}

      {page && page.content.length === 0 && (
        <p className="column-empty">Nenhum pedido aqui.</p>
      )}

      {page && page.content.length > 0 && (
        <div className="column-list">
          {page.content.map((order, i) => (
            <div key={order.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <OrderCard order={order} notify={notify} />
            </div>
          ))}
          {page.totalElements > page.content.length && (
            <p className="column-truncated">+{page.totalElements - page.content.length} não exibidos</p>
          )}
        </div>
      )}
    </section>
  );
}
```

`web/src/features/orders/CanceledTray.tsx` (see plan §D1 — cancelled orders are an exit, shown *below* the pipeline, collapsed by default):
```tsx
import { STATUS_META } from "./statusMeta";
import { OrderCard } from "./OrderCard";
import { useOrdersByStatus } from "./useOrders";

export function CanceledTray({ notify }: { notify: (msg: string) => void }) {
  const meta = STATUS_META.CANCELADO;
  const query = useOrdersByStatus("CANCELADO");
  const page = query.data;

  return (
    <details className="canceled-tray">
      <summary>
        <span className="badge" style={{ background: meta.bg, color: meta.ink }}>
          {meta.icon} Cancelados
        </span>
        <span className="column-count mono">{page?.totalElements ?? "…"}</span>
      </summary>
      {page && page.content.length === 0 && <p className="column-empty">Nenhum pedido cancelado.</p>}
      {page && page.content.length > 0 && (
        <div className="tray-list">
          {page.content.map((order) => (
            <div key={order.id} className="tray-card">
              <OrderCard order={order} notify={notify} />
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
```

`web/src/features/orders/BoardPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { CanceledTray } from "./CanceledTray";
import { Column } from "./Column";
import { PIPELINE } from "./statusMeta";
import "./board.css";

export default function BoardPage() {
  const location = useLocation();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if ((location.state as { created?: boolean } | null)?.created) {
      setToast("Pedido criado.");
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="board-page">
      <h1 className="board-title">Pedidos</h1>

      <div className="board-columns">
        {PIPELINE.map((status) => (
          <Column key={status} status={status} notify={setToast} />
        ))}
      </div>

      <CanceledTray notify={setToast} />

      <div aria-live="polite" className="toast-region">
        {toast && <p className="toast">{toast}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `board.css`**

```css
.board-page { display: flex; flex-direction: column; gap: var(--sp-4); }
.board-title { margin-bottom: var(--sp-1); }

.board-columns {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-4);
  align-items: start;
}

.board-column {
  background: var(--surface-dim);
  border: 1px solid var(--line);
  border-top: 3px solid; /* color set inline from STATUS_META */
  border-radius: var(--r-lg);
  padding: var(--sp-3);
  min-height: 12rem;
}

.column-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: var(--sp-3);
}
.column-count { color: var(--ink-soft); font-size: var(--text-sm); }

.column-list { display: flex; flex-direction: column; gap: var(--sp-3); }
.column-empty {
  color: var(--ink-soft); font-size: var(--text-sm);
  text-align: center; padding: var(--sp-5) var(--sp-2);
  display: flex; flex-direction: column; gap: var(--sp-2); align-items: center;
}
.column-truncated { color: var(--ink-soft); font-size: var(--text-sm); text-align: center; }

/* ticket cards */
.order-card { padding: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); }
.order-card-top { display: flex; justify-content: space-between; align-items: baseline; }
.order-id { font-size: var(--text-sm); color: var(--ink-soft); }
.order-time { font-size: var(--text-sm); color: var(--ink-soft); }
.order-summary { font-weight: 600; }
.order-more { color: var(--ink-soft); font-weight: 400; }
.order-place { font-size: var(--text-sm); color: var(--ink-soft); }

.order-details summary {
  cursor: pointer; font-size: var(--text-sm); color: var(--ink-soft);
  min-height: 32px; display: flex; align-items: center;
}
.order-items { list-style: none; padding: var(--sp-2) 0; display: flex; flex-direction: column; gap: var(--sp-1); }
.order-items li { display: flex; justify-content: space-between; gap: var(--sp-2); font-size: var(--text-sm); }
.order-address { font-size: var(--text-sm); color: var(--ink-soft); }

.order-card-bottom {
  display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2);
  flex-wrap: wrap;
  border-top: 1px dashed var(--line); /* ticket tear-line */
  padding-top: var(--sp-2);
}
.order-total { font-size: var(--text-lg); }
.order-actions { display: flex; gap: var(--sp-1); flex-wrap: wrap; justify-content: flex-end; }
.order-cancel-confirm { background: var(--danger); }

/* entrance stagger — transform/opacity only; killed by reduced-motion via index.css */
.card-enter { animation: card-in 180ms ease-out backwards; }
@keyframes card-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

/* skeletons */
.skeleton-card {
  height: 7.5rem; border-radius: var(--r-lg);
  background: linear-gradient(100deg, var(--surface) 40%, var(--surface-dim) 50%, var(--surface) 60%);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }

/* cancelled tray: an exit below the flow, not a fifth stage */
.canceled-tray {
  border: 1px dashed var(--line);
  border-radius: var(--r-lg);
  padding: var(--sp-2) var(--sp-3);
  opacity: 0.9;
}
.canceled-tray > summary {
  cursor: pointer; list-style: none;
  display: flex; align-items: center; gap: var(--sp-2);
  min-height: 44px;
}
.canceled-tray > summary::before { content: "▸"; color: var(--ink-soft); }
.canceled-tray[open] > summary::before { content: "▾"; }
.tray-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--sp-3);
  padding-top: var(--sp-3);
}
.tray-card { opacity: 0.75; }

/* toast */
.toast-region { position: fixed; inset-inline: 0; bottom: var(--sp-4); display: flex; justify-content: center; pointer-events: none; z-index: 50; }
.toast {
  background: var(--ink); color: var(--bg);
  padding: var(--sp-2) var(--sp-4); border-radius: 999px;
  box-shadow: var(--shadow-md); font-size: var(--text-sm);
}
```

- [ ] **Step 6: Wire providers and route**

In `web/src/main.tsx`, add TanStack Query around `<App/>` (inside `AuthProvider`):
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./api/http";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status > 0 && error.status < 500) && failureCount < 2,
      staleTime: 5_000,
    },
  },
});
```
…and wrap: `<AuthProvider><QueryClientProvider client={queryClient}><App /></QueryClientProvider></AuthProvider>`.

In `web/src/App.tsx`: delete `BoardPlaceholder`, `import BoardPage from "./features/orders/BoardPage";`, and set `<Route index element={<BoardPage />} />`.

- [ ] **Step 7: Verify**

Run: `cd web && npm run build && npm test` → Expected: green.
Manual smoke with backend + dev server running: log in; the four columns render with counts; create test orders via Swagger (`http://localhost:8080/swagger-ui/index.html`, Authorize with the token from devtools localStorage `foody.auth`) or wait for Task 7; advance an order `RECEBIDO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE` — the card moves column on each click; cancel a `RECEBIDO` order → inline confirmation → card lands in the "Cancelados" tray below the board; `ENTREGUE` and `SAIU_PARA_ENTREGA` cards offer **no** cancel button; empty columns show "Nenhum pedido aqui.". Restart the backend and click any advance button: you are redirected to `/login` with "Sua sessão expirou." (fact: keys rotate on boot).

- [ ] **Step 8: Commit**

```bash
git add web/src
git commit -m "feat(web): kanban board with pipeline columns and cancelled-orders tray"
```

---

### Task 6: Responsive board — mobile status tabs

**Files:**
- Create: `web/src/lib/useMediaQuery.ts`, `web/src/features/orders/MobileBoard.tsx`
- Modify: `web/src/features/orders/BoardPage.tsx`, `web/src/features/orders/board.css`, `web/src/components/appshell.css`

**Interfaces:**
- Consumes (Task 5): `Column`, `CanceledTray` are *not* reused on mobile — `MobileBoard` reuses `OrderCard`, `STATUS_META`, `PIPELINE`, `useOrdersByStatus`; (Task 3) types.
- Produces: `useMediaQuery(query: string): boolean`; `MobileBoard({ notify }: { notify: (msg: string) => void })`.

**Skills:** invoke `responsive-design` (mobile-first, `100dvh` not `100vh`, content-based breakpoint at 1024px, no horizontal page scroll — the tab bar scrolls inside its own `overflow-x: auto` container with scroll-snap) and `ui-ux-pro-max` (§2 touch targets ≥44px with ≥8px gaps, §9 tabs show active state by more than color — underline indicator + `aria-selected`, counts as badges). This implements plan §D2 exactly — do not improvise a squeezed 4-column layout.

- [ ] **Step 1: `useMediaQuery` via `useSyncExternalStore`**

`web/src/lib/useMediaQuery.ts`:
```ts
import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
```

- [ ] **Step 2: MobileBoard**

`web/src/features/orders/MobileBoard.tsx`:
```tsx
import { useState } from "react";
import type { OrderStatus } from "../../api/types";
import { OrderCard } from "./OrderCard";
import { PIPELINE, STATUS_META } from "./statusMeta";
import { useOrdersByStatus } from "./useOrders";

const TABS: readonly OrderStatus[] = [...PIPELINE, "CANCELADO"];

function Tab({ status, active, onSelect }: {
  status: OrderStatus; active: boolean; onSelect: (s: OrderStatus) => void;
}) {
  const meta = STATUS_META[status];
  const query = useOrdersByStatus(status); // cached; shared with the desktop board
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`mtab${active ? " mtab-active" : ""}${status === "CANCELADO" ? " mtab-exit" : ""}`}
      style={active ? { borderBottomColor: meta.ink, color: meta.ink } : undefined}
      onClick={() => onSelect(status)}
    >
      {meta.icon} {meta.label}
      <span className="mtab-count mono">{query.data?.totalElements ?? "…"}</span>
    </button>
  );
}

export function MobileBoard({ notify }: { notify: (msg: string) => void }) {
  const [selected, setSelected] = useState<OrderStatus>("RECEBIDO");
  const query = useOrdersByStatus(selected);
  const page = query.data;

  return (
    <div className="mboard">
      <div className="mtabs" role="tablist" aria-label="Status do pedido">
        {TABS.map((status) => (
          <Tab key={status} status={status} active={selected === status} onSelect={setSelected} />
        ))}
      </div>

      <div className="mboard-list" role="tabpanel" aria-label={STATUS_META[selected].label}>
        {query.isPending && (
          <><div className="skeleton-card" /><div className="skeleton-card" /></>
        )}
        {query.isError && (
          <div className="column-empty">
            <p>Não foi possível carregar.</p>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => query.refetch()}>
              Tentar de novo
            </button>
          </div>
        )}
        {page && page.content.length === 0 && <p className="column-empty">Nenhum pedido aqui.</p>}
        {page?.content.map((order) => (
          <OrderCard key={order.id} order={order} notify={notify} />
        ))}
        {page && page.totalElements > page.content.length && (
          <p className="column-truncated">+{page.totalElements - page.content.length} não exibidos</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Switch in BoardPage**

In `web/src/features/orders/BoardPage.tsx` add:
```tsx
import { useMediaQuery } from "../../lib/useMediaQuery";
import { MobileBoard } from "./MobileBoard";
```
and replace the columns/tray block with:
```tsx
      {isDesktop ? (
        <>
          <div className="board-columns">
            {PIPELINE.map((status) => (
              <Column key={status} status={status} notify={setToast} />
            ))}
          </div>
          <CanceledTray notify={setToast} />
        </>
      ) : (
        <MobileBoard notify={setToast} />
      )}
```
with `const isDesktop = useMediaQuery("(min-width: 1024px)");` at the top of the component. Rendering only one tree avoids double-fetching and double DOM (vercel-react-best-practices).

- [ ] **Step 4: Mobile CSS**

Append to `web/src/features/orders/board.css`:
```css
/* ——— mobile board (<1024px): segmented single-status list — plan §D2 ——— */
.mboard { display: flex; flex-direction: column; gap: var(--sp-3); }

.mtabs {
  display: flex; gap: var(--sp-2);
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  position: sticky; top: 68px; /* below the shell header */
  background: var(--bg);
  z-index: 10;
  padding: var(--sp-1) 0;
}
.mtabs::-webkit-scrollbar { display: none; }

.mtab {
  scroll-snap-align: start;
  display: inline-flex; align-items: center; gap: var(--sp-1);
  min-height: 44px;
  padding: 0 var(--sp-3);
  white-space: nowrap;
  border: none; background: none; cursor: pointer;
  border-bottom: 3px solid transparent;
  color: var(--ink-soft); font-weight: 600; font-size: var(--text-sm);
  touch-action: manipulation;
}
.mtab-active { /* border-bottom-color + color set inline from STATUS_META */ }
.mtab-count {
  background: var(--surface-dim); border-radius: 999px;
  padding: 0 var(--sp-2); font-size: 0.75rem;
}
/* Cancelados is a filter here, not a stage: divided and dimmed (plan §D1/D2) */
.mtab-exit { border-left: 1px solid var(--line); margin-left: var(--sp-2); padding-left: var(--sp-4); opacity: 0.8; }

.mboard-list { display: flex; flex-direction: column; gap: var(--sp-3); }
```

Append to `web/src/components/appshell.css`:
```css
@media (max-width: 479px) {
  .shell-header { padding-inline: var(--sp-3); }
  .brand { font-size: var(--text-lg); }
  .shell-nav .btn { padding-inline: var(--sp-3); }
}
```

- [ ] **Step 5: Verify**

Run: `cd web && npm run build && npm test` → green.
Manual (backend + dev server up, logged in): in browser devtools set viewport to **375×667** — the board shows the tab bar + single list, no horizontal page scroll (only the tab bar itself scrolls); tabs are ≥44px tall; Cancelados tab sits after a divider, dimmed; counts match desktop; advancing a card from "Recebido" makes it disappear from the current tab (and appear under "Em preparo"). Widen to ≥1024px — the 4-column board returns. Rotate to landscape (667×375): still usable, no clipped content.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat(web): mobile board as segmented status tabs under 1024px"
```

---

### Task 7: New order form

**Files:**
- Create: `web/src/features/orders/NewOrderPage.tsx`, `web/src/features/orders/neworder.css`
- Modify: `web/src/App.tsx` (add route `orders/new`)

**Interfaces:**
- Consumes: `createOrder` (Task 3), `parseBRLToCents`/`formatCentsBRL`, `stripCep`/`maskCep`, `ApiError`, types; navigates to `/` with `state: { created: true }` which BoardPage (Task 5) already turns into a toast.
- Produces: `NewOrderPage` default export; route `/orders/new` inside the protected shell.

**Skills:** invoke `ui-ux-pro-max` (§8: labels above fields, error under the exact field, `inputMode` for the right mobile keyboard, focus first invalid field after failed submit, required markers, disabled submit while pending) and `responsive-design` (address grid collapses to one column on small screens; sticky summary bar; fields ≥44px tall — already guaranteed by `.field` from Task 2).

Key data rules this form owns: prices typed as pt-BR text (`"12,50"`) and converted to **integer cents** via `parseBRLToCents` — no floats ever; CEP displayed masked (`01310-100`) but **stored and sent as 8 bare digits**; `state` is a 27-UF select (2 chars by construction); server 400 `errors[]` fields (`items[0].unitPriceCents`, `deliveryAddress.zipCode`, …) map back onto inputs whose `id` equals the API field path.

- [ ] **Step 1: Page**

`web/src/features/orders/NewOrderPage.tsx`:
```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "../../api/http";
import { createOrder } from "../../api/orders";
import type { CreateOrderRequest } from "../../api/types";
import { maskCep, stripCep } from "../../lib/cep";
import { formatCentsBRL, parseBRLToCents } from "../../lib/money";
import "./neworder.css";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RO","RR","RS","SC","SP","SE","TO"];

interface ItemRow { key: number; productName: string; price: string; quantity: string; }
let nextKey = 1;
const emptyRow = (): ItemRow => ({ key: nextKey++, productName: "", price: "", quantity: "1" });

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ItemRow[]>([emptyRow()]);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState(""); // bare digits, max 8
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (req: CreateOrderRequest) => createOrder(req),
    onSuccess: () => navigate("/", { state: { created: true } }),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors.length > 0) {
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) mapped[fe.field] = fe.message;
        setErrors(mapped);
        focusFirst(Object.keys(mapped));
      } else {
        setFormError(err instanceof Error ? err.message : "Erro inesperado.");
      }
    },
  });

  function focusFirst(keys: string[]) {
    if (keys.length > 0) document.getElementById(keys[0])?.focus();
  }

  function setItem(key: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Live total: integer cents only. Unparseable rows contribute 0 until fixed.
  const totalCents = items.reduce((sum, row) => {
    const cents = parseBRLToCents(row.price);
    const qty = Number.parseInt(row.quantity, 10);
    return cents !== null && Number.isInteger(qty) && qty >= 1 ? sum + cents * qty : sum;
  }, 0);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    items.forEach((row, i) => {
      if (!row.productName.trim()) errs[`items[${i}].productName`] = "Informe o produto.";
      if (parseBRLToCents(row.price) === null) errs[`items[${i}].unitPriceCents`] = "Preço inválido — use 0,00.";
      const qty = Number.parseInt(row.quantity, 10);
      if (!Number.isInteger(qty) || qty < 1) errs[`items[${i}].quantity`] = "Quantidade mínima: 1.";
    });
    if (!street.trim()) errs["deliveryAddress.street"] = "Informe a rua.";
    else if (street.length > 150) errs["deliveryAddress.street"] = "Máximo de 150 caracteres.";
    if (!number.trim()) errs["deliveryAddress.number"] = "Informe o número.";
    else if (number.length > 20) errs["deliveryAddress.number"] = "Máximo de 20 caracteres.";
    if (complement.length > 150) errs["deliveryAddress.complement"] = "Máximo de 150 caracteres.";
    if (!district.trim()) errs["deliveryAddress.district"] = "Informe o bairro.";
    else if (district.length > 100) errs["deliveryAddress.district"] = "Máximo de 100 caracteres.";
    if (!city.trim()) errs["deliveryAddress.city"] = "Informe a cidade.";
    else if (city.length > 100) errs["deliveryAddress.city"] = "Máximo de 100 caracteres.";
    if (!uf) errs["deliveryAddress.state"] = "Selecione a UF.";
    if (cep.length !== 8) errs["deliveryAddress.zipCode"] = "CEP deve ter 8 dígitos.";
    return errs;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusFirst(Object.keys(errs));
      return;
    }
    mutation.mutate({
      items: items.map((row) => ({
        productName: row.productName.trim(),
        unitPriceCents: parseBRLToCents(row.price)!,
        quantity: Number.parseInt(row.quantity, 10),
      })),
      deliveryAddress: {
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() === "" ? null : complement.trim(),
        district: district.trim(),
        city: city.trim(),
        state: uf,
        zipCode: cep, // 8 bare digits — the mask is display-only
      },
    });
  }

  return (
    <form className="neworder" onSubmit={onSubmit} noValidate>
      <h1>Novo pedido</h1>
      {formError && <p className="auth-alert" role="alert">{formError}</p>}

      <fieldset className="no-section card">
        <legend>Itens</legend>
        {items.map((row, i) => (
          <div className="no-item-row" key={row.key}>
            <div className="field no-item-name">
              <label htmlFor={`items[${i}].productName`}>Produto</label>
              <input id={`items[${i}].productName`} value={row.productName}
                aria-invalid={!!errors[`items[${i}].productName`]}
                onChange={(e) => setItem(row.key, { productName: e.target.value })} />
              {errors[`items[${i}].productName`] && (
                <span className="field-error" role="alert">{errors[`items[${i}].productName`]}</span>
              )}
            </div>
            <div className="field no-item-price">
              <label htmlFor={`items[${i}].unitPriceCents`}>Preço unit. (R$)</label>
              <input id={`items[${i}].unitPriceCents`} inputMode="decimal" placeholder="0,00"
                value={row.price}
                aria-invalid={!!errors[`items[${i}].unitPriceCents`]}
                onChange={(e) => setItem(row.key, { price: e.target.value })} />
              {errors[`items[${i}].unitPriceCents`] && (
                <span className="field-error" role="alert">{errors[`items[${i}].unitPriceCents`]}</span>
              )}
            </div>
            <div className="field no-item-qty">
              <label htmlFor={`items[${i}].quantity`}>Qtde.</label>
              <input id={`items[${i}].quantity`} inputMode="numeric" value={row.quantity}
                aria-invalid={!!errors[`items[${i}].quantity`]}
                onChange={(e) => setItem(row.key, { quantity: e.target.value.replace(/\D/g, "") })} />
              {errors[`items[${i}].quantity`] && (
                <span className="field-error" role="alert">{errors[`items[${i}].quantity`]}</span>
              )}
            </div>
            <button type="button" className="btn btn-sm btn-danger-ghost no-item-remove"
              disabled={items.length === 1}
              onClick={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}>
              Remover
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost"
          onClick={() => setItems((rows) => [...rows, emptyRow()])}>
          + Adicionar item
        </button>
      </fieldset>

      <fieldset className="no-section card">
        <legend>Endereço de entrega</legend>
        <div className="no-addr-grid">
          <div className="field no-span2">
            <label htmlFor="deliveryAddress.street">Rua</label>
            <input id="deliveryAddress.street" maxLength={150} value={street}
              aria-invalid={!!errors["deliveryAddress.street"]}
              onChange={(e) => setStreet(e.target.value)} autoComplete="street-address" />
            {errors["deliveryAddress.street"] && (
              <span className="field-error" role="alert">{errors["deliveryAddress.street"]}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.number">Número</label>
            <input id="deliveryAddress.number" maxLength={20} value={number}
              aria-invalid={!!errors["deliveryAddress.number"]}
              onChange={(e) => setNumber(e.target.value)} />
            {errors["deliveryAddress.number"] && (
              <span className="field-error" role="alert">{errors["deliveryAddress.number"]}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.complement">Complemento (opcional)</label>
            <input id="deliveryAddress.complement" maxLength={150} value={complement}
              aria-invalid={!!errors["deliveryAddress.complement"]}
              onChange={(e) => setComplement(e.target.value)} />
            {errors["deliveryAddress.complement"] && (
              <span className="field-error" role="alert">{errors["deliveryAddress.complement"]}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.district">Bairro</label>
            <input id="deliveryAddress.district" maxLength={100} value={district}
              aria-invalid={!!errors["deliveryAddress.district"]}
              onChange={(e) => setDistrict(e.target.value)} />
            {errors["deliveryAddress.district"] && (
              <span className="field-error" role="alert">{errors["deliveryAddress.district"]}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.city">Cidade</label>
            <input id="deliveryAddress.city" maxLength={100} value={city}
              aria-invalid={!!errors["deliveryAddress.city"]}
              onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
            {errors["deliveryAddress.city"] && (
              <span className="field-error" role="alert">{errors["deliveryAddress.city"]}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.state">UF</label>
            <select id="deliveryAddress.state" value={uf}
              aria-invalid={!!errors["deliveryAddress.state"]}
              onChange={(e) => setUf(e.target.value)}>
              <option value="">—</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {errors["deliveryAddress.state"] && (
              <span className="field-error" role="alert">{errors["deliveryAddress.state"]}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.zipCode">CEP</label>
            <input id="deliveryAddress.zipCode" inputMode="numeric" placeholder="00000-000"
              value={maskCep(cep)}
              aria-invalid={!!errors["deliveryAddress.zipCode"]}
              onChange={(e) => setCep(stripCep(e.target.value))}
              autoComplete="postal-code" />
            {errors["deliveryAddress.zipCode"] && (
              <span className="field-error" role="alert">{errors["deliveryAddress.zipCode"]}</span>
            )}
          </div>
        </div>
      </fieldset>

      <div className="no-footer">
        <span>Total: <strong className="mono no-total">{formatCentsBRL(totalCents)}</strong></span>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Enviando…" : "Criar pedido"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: `neworder.css`**

```css
.neworder {
  display: flex; flex-direction: column; gap: var(--sp-4);
  max-width: 46rem; margin: 0 auto;
}

.no-section { border: none; padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.no-section > legend {
  font-family: var(--font-display); font-size: var(--text-lg); font-weight: 600;
  padding: 0; margin-bottom: var(--sp-2);
}

.no-item-row {
  display: grid;
  grid-template-columns: 1fr 8.5rem 5rem auto;
  gap: var(--sp-2);
  align-items: start;
}
.no-item-remove { align-self: end; }

.no-addr-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3);
}
.no-span2 { grid-column: span 2; }

.no-footer {
  position: sticky; bottom: 0;
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: var(--sp-3) var(--sp-4);
  box-shadow: var(--shadow-md);
}
.no-total { font-size: var(--text-lg); }

@media (max-width: 639px) {
  .no-item-row { grid-template-columns: 1fr 1fr; }
  .no-item-name { grid-column: span 2; }
  .no-item-remove { justify-self: end; }
  .no-addr-grid { grid-template-columns: 1fr; }
  .no-span2 { grid-column: auto; }
}
```

- [ ] **Step 3: Route**

In `web/src/App.tsx`: `import NewOrderPage from "./features/orders/NewOrderPage";` and inside the protected shell route add `<Route path="orders/new" element={<NewOrderPage />} />`.

- [ ] **Step 4: Verify**

Run: `cd web && npm run build && npm test` → green.
Manual (backend + dev server up, logged in): "Novo pedido" → add two items ("Pizza Margherita" / `45,90` / 1 and "Guaraná 2L" / `12,50` / 2) → live total reads **R$ 70,90** (4590 + 1250×2 = 7090 cents — integer math); fill address with CEP typed as "01310-100" → submit succeeds (mask stripped to `01310100`), lands on the board with the "Pedido criado." toast and the new card in **Recebido**; submit with an empty product name → error under that exact field, focus jumps to it; type CEP "123" → "CEP deve ter 8 dígitos."; at 375px width the form is single-column with the sticky total bar.

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(web): new order form with cents-safe prices and CEP mask"
```

---

### Task 8: Documentation — how to run the frontend

**Files:**
- Create: `web/README.md`
- Modify: `README.md` (repo root — docs only, no layout change)

**Interfaces:** consumes nothing; produces the run instructions a reviewer will follow.

**Skills:** none of the four (documentation). Match the root README's pt-BR tone.

- [ ] **Step 1: `web/README.md`**

```markdown
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

Abra <http://localhost:5173>. Crie uma conta em "Crie sua conta" e pronto —
o quadro mostra as quatro etapas do pedido; pedidos cancelados ficam na
bandeja "Cancelados" abaixo do quadro (cancelamento é uma saída do fluxo,
não uma etapa).

A URL da API pode ser trocada com a variável `VITE_API_BASE_URL`
(padrão: `http://localhost:8080/api/v1`):

```bash
VITE_API_BASE_URL=http://outro-host:8080/api/v1 npm run dev
```

## Testes e build

```bash
npm test        # unitários (vitest): dinheiro em centavos, CEP, cliente HTTP
npm run build   # typecheck + build de produção
npm run preview # serve o build em http://localhost:4173 (origem liberada no CORS)
```

## Decisões

- **Dinheiro é sempre inteiro em centavos** — nenhuma aritmética de ponto
  flutuante toca valores; formatação/parse centralizados em `src/lib/money.ts`.
- **CANCELADO não é coluna**: o quadro mostra só o pipeline
  `RECEBIDO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE`; cancelados ficam
  numa bandeja recolhível abaixo — cancelar é sair do fluxo.
- **Mobile (<1024px)**: o quadro vira abas de status (filtros) com lista única.
- **Sessão**: o token JWT expira em 1h e é invalidado quando o backend
  reinicia; qualquer 401 derruba a sessão para a tela de login com aviso.
- Dependências de runtime: React, react-router, TanStack Query e duas
  fontes self-hosted — nada além disso.
```

- [ ] **Step 2: Root `README.md` section**

Insert right after the "## Como rodar" section's final paragraph (the one ending with "Não há passo de setup manual.") and **before** the `Testes:` block, keeping everything else untouched:

```markdown
### Frontend (web/)

O frontend (Vite + React) vive em [`web/`](web/README.md). Com a API no ar:

```bash
cd web
npm install
npm run dev   # http://localhost:5173
```

Detalhes, decisões e testes: [`web/README.md`](web/README.md).
```

- [ ] **Step 3: Verify**

Run: `cd web && npm run build` (still green — docs only).
Read both READMEs top to bottom and follow the commands literally in a clean shell; they must work as written.

- [ ] **Step 4: Commit**

```bash
git add web/README.md README.md
git commit -m "docs: how to run the frontend"
```

---

### Task 9: Full-stack verification against a live backend

**Files:** none created (verification only; fix regressions in place if found and note them).

**Interfaces:** consumes everything; produces the final green light.

**Skills:** invoke `responsive-design` (final 375px + landscape pass) and use the `agent-browser` skill (or `playwright-cli`) for the browser walkthrough. Also re-check ui-ux-pro-max §1–§3 critical items during the walkthrough (focus rings visible, touch targets, no layout shift on load).

- [ ] **Step 1: Backend suite is still 111/111**

Run: `cd /Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery && ./mvnw -q test`
Expected: `Tests run: 111, Failures: 0, Errors: 0`.

- [ ] **Step 2: Frontend checks are green**

Run: `cd web && npm test && npm run build`
Expected: all vitest suites pass; production build succeeds.

- [ ] **Step 3: Boot both halves**

```bash
cd /Users/rodrigoandradebccgmail.com/Dev/Study/FoodyDelivery
./mvnw spring-boot:run > /tmp/foody-boot.log 2>&1 &
cd web && npm run dev > /tmp/foody-web.log 2>&1 &
sleep 25
curl -is -X OPTIONS http://localhost:8080/api/v1/orders \
  -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
```
Expected: `Access-Control-Allow-Origin: http://localhost:5173`.

- [ ] **Step 4: Browser walkthrough at `http://localhost:5173`** (desktop viewport)

1. Visiting `/` unauthenticated redirects to `/login`.
2. Register a fresh account (`reviewer+<timestamp>@test.com` / `senha1234`) → lands on the board, four columns visible, all empty-state or populated, no console errors.
3. Create order A (2 items, CEP typed with mask) → board shows toast "Pedido criado." and card in **Recebido** with the correct BRL total.
4. Advance A: Iniciar preparo → Despachar entrega → Confirmar entrega. Card traverses all four columns; in **Saiu para entrega** and **Entregue** there is no "Cancelar" button.
5. Create order B; cancel it from **Recebido** via the inline confirmation → card appears in the **Cancelados** tray (count 1, collapsed by default, expandable).
6. Wrong-password login attempt shows the single generic message "E-mail ou senha incorretos.".
7. Duplicate registration shows the 409 message on the e-mail field.
8. Network tab: no CORS errors anywhere; `POST /orders` request body has `unitPriceCents` as integers and `zipCode` as 8 bare digits.

- [ ] **Step 5: Session-death degradation (the RSA-restart fact)**

Restart the backend (`kill` the boot process, `./mvnw spring-boot:run` again, wait for boot). In the still-open board, click any advance button (or wait ≤15s for the poll). Expected: clean redirect to `/login` showing "Sua sessão expirou. Entre novamente." — no blank screen, no raw error, no infinite spinner. Log back in → board intact.

- [ ] **Step 6: Responsive pass**

At 375×667: board is tab bar + single list, no horizontal page scroll, tabs ≥44px, Cancelados tab divided+dimmed, new-order form single-column with sticky total. At 667×375 (landscape): usable. Back at ≥1024px: 4 columns return.

- [ ] **Step 7: Shut down and report**

Kill both dev processes. Report PASS/FAIL per step above; any FAIL gets fixed and its task's verification re-run before this task is marked complete.

- [ ] **Step 8: Final commit (only if fixes were made)**

```bash
git add -A web src/main/java/com/foody/delivery/config/SecurityConfig.java README.md
git commit -m "fix: final full-stack verification adjustments"
```
