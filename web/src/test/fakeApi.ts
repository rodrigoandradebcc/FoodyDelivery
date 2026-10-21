import { vi } from "vitest";
import type { CreateOrderRequest, OrderResponse, OrderStatus } from "../api/types";

const API = "http://localhost:8080/api/v1";

export const VALID_USER = { email: "ana@foody.dev", password: "segredo123" };

export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
  authorization: string | null;
}

export interface FakeApi {
  orders: OrderResponse[];
  calls: RecordedCall[];
  expireSession: () => void;
}

function json(status: number, body: unknown, type = "application/json"): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": type } });
}

function problem(status: number, title: string, detail?: string): Response {
  return json(status, { status, title, detail }, "application/problem+json");
}

export function makeOrder(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    customerName: "Bruno Lima",
    status: "RECEBIDO",
    totalCents: 4590,
    items: [{ productName: "Pizza margherita", unitPriceCents: 4590, quantity: 1 }],
    deliveryAddress: {
      street: "Rua das Flores",
      number: "10",
      complement: null,
      district: "Centro",
      city: "Recife",
      state: "PE",
      zipCode: "50000000",
    },
    createdAt: "2026-10-19T12:00:00Z",
    updatedAt: "2026-10-19T12:00:00Z",
    ...overrides,
  };
}

export function seedSession(): void {
  localStorage.setItem(
    "foody.auth",
    JSON.stringify({ token: "token-valido", expiresAt: Date.now() + 3_600_000 }),
  );
}

export function installFakeApi(initialOrders: OrderResponse[] = []): FakeApi {
  const state: FakeApi & { expired: boolean } = {
    orders: [...initialOrders],
    calls: [],
    expired: false,
    expireSession: () => {
      state.expired = true;
    },
  };
  let sequence = initialOrders.length;

  vi.stubGlobal("fetch", async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const headers = (init.headers ?? {}) as Record<string, string>;

    if (url.hostname === "viacep.com.br") {
      return json(200, { logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" });
    }

    const path = url.href.slice(API.length);
    state.calls.push({ method, path, body, authorization: headers.Authorization ?? null });

    if (method === "POST" && path === "/auth/login") {
      const { email, password } = body as typeof VALID_USER;
      if (email === VALID_USER.email && password === VALID_USER.password) {
        return json(200, { accessToken: "token-valido", tokenType: "Bearer", expiresIn: 3600 });
      }
      return problem(401, "Unauthorized", "Credenciais inválidas");
    }

    if (state.expired || headers.Authorization !== "Bearer token-valido") {
      return problem(401, "Unauthorized");
    }

    if (method === "GET" && url.pathname.endsWith("/orders")) {
      const status = url.searchParams.get("status") as OrderStatus | null;
      const content = state.orders.filter((o) => !status || o.status === status);
      return json(200, { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 });
    }

    if (method === "POST" && path === "/orders") {
      const req = body as CreateOrderRequest;
      sequence += 1;
      const created = makeOrder({
        ...req,
        id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
        status: "RECEBIDO",
        totalCents: req.items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
      });
      state.orders.push(created);
      return json(201, created);
    }

    const statusMatch = /^\/orders\/([^/]+)\/status$/.exec(path);
    if (method === "PATCH" && statusMatch) {
      const order = state.orders.find((o) => o.id === decodeURIComponent(statusMatch[1]));
      if (!order) return problem(404, "Not Found");
      order.status = (body as { status: OrderStatus }).status;
      return json(200, order);
    }

    const idMatch = /^\/orders\/([^/]+)$/.exec(path);
    if (method === "GET" && idMatch) {
      const order = state.orders.find((o) => o.id === decodeURIComponent(idMatch[1]));
      return order ? json(200, order) : problem(404, "Not Found", "Pedido não encontrado");
    }

    return problem(404, "Not Found");
  });

  return state;
}
