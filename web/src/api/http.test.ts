import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, request, setOnUnauthorized, setTokenProvider } from "./http";

afterEach(() => {
  vi.unstubAllGlobals();
  setOnUnauthorized(() => {});
  setTokenProvider(() => null);
});

async function rejectsWithApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected the request to reject with an ApiError, but it resolved");
}

function stubFetch(impl: () => Response): ReturnType<typeof vi.fn<typeof fetch>> {
  const mock = vi.fn<typeof fetch>(async () => impl());
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("request", () => {
  it("survives the filter-chain 401 (EMPTY body, no JSON) and fires onUnauthorized", async () => {
    stubFetch(() => new Response(null, { status: 401, headers: { "WWW-Authenticate": "Bearer" } }));
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);

    const err = await rejectsWithApiError(request("/orders"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.problem).toBeNull();
    expect(err.fieldErrors).toEqual([]);
    expect(err.message).toBe("Erro HTTP 401");
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does not throw when a JSON content-type carries an empty body", async () => {
    stubFetch(
      () => new Response("", { status: 401, headers: { "Content-Type": "application/problem+json" } }),
    );
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);

    const err = await rejectsWithApiError(request("/orders"));
    expect(err.status).toBe(401);
    expect(err.problem).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does NOT fire onUnauthorized for auth-less calls (login failure)", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ title: "Unauthorized", detail: "Credenciais inválidas", status: 401 }),
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        ),
    );
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);

    const err = await rejectsWithApiError(
      request("/auth/login", { method: "POST", body: {}, auth: false }),
    );
    expect(err.status).toBe(401);
    expect(err.problem?.detail).toBe("Credenciais inválidas");
    expect(err.message).toBe("Credenciais inválidas");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("parses RFC 7807 field errors and preserves nested field paths", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            title: "Bad Request",
            status: 400,
            errors: [
              { field: "deliveryAddress.zipCode", message: "tamanho deve ser 8" },
              { field: "items[0].quantity", message: "deve ser maior ou igual a 1" },
            ],
          }),
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
    );

    const err = await rejectsWithApiError(request("/orders", { method: "POST", body: {} }));
    expect(err.fieldErrors).toEqual([
      { field: "deliveryAddress.zipCode", message: "tamanho deve ser 8" },
      { field: "items[0].quantity", message: "deve ser maior ou igual a 1" },
    ]);

    expect(err.fieldErrors.map((f) => f.field)).toEqual([
      "deliveryAddress.zipCode",
      "items[0].quantity",
    ]);
  });

  it("attaches the Bearer token and parses JSON on success", async () => {
    const fetchMock = stubFetch(
      () => new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    setTokenProvider(() => "tok123");

    await expect(request("/orders")).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://localhost:8080/api/v1/orders");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok123");
  });

  it("omits the Authorization header when auth is false", async () => {
    const fetchMock = stubFetch(
      () => new Response(JSON.stringify({ accessToken: "x" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    setTokenProvider(() => "tok123");

    await request("/auth/login", { method: "POST", body: { email: "a@b.c" }, auth: false });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ email: "a@b.c" }));
  });

  it("returns undefined for a 201 with no JSON body", async () => {
    stubFetch(() => new Response(null, { status: 201, headers: { Location: "/api/v1/orders/abc" } }));
    await expect(request("/orders", { method: "POST", body: {} })).resolves.toBeUndefined();
  });

  it("turns a network failure into an ApiError with status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const err = await rejectsWithApiError(request("/orders"));
    expect(err.status).toBe(0);
    expect(err.problem?.title).toBe("API indisponível");
  });
});
