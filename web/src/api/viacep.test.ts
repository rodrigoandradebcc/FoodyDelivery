import { afterEach, describe, expect, it, vi } from "vitest";
import { CepNotFoundError, lookupCep } from "./viacep";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: () => Response): ReturnType<typeof vi.fn<typeof fetch>> {
  const mock = vi.fn<typeof fetch>(async () => impl());
  vi.stubGlobal("fetch", mock);
  return mock;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("lookupCep", () => {
  it("maps the ViaCEP payload onto the order's address fields", async () => {
    const mock = stubFetch(() =>
      jsonResponse({
        cep: "01310-100",
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        localidade: "São Paulo",
        uf: "sp",
      }),
    );

    await expect(lookupCep("01310100")).resolves.toEqual({
      street: "Avenida Paulista",
      district: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    });
    expect(mock).toHaveBeenCalledWith("https://viacep.com.br/ws/01310100/json/", {
      signal: undefined,
    });
  });

  it("treats the 200-with-erro payload as not found", async () => {
    stubFetch(() => jsonResponse({ erro: "true" }));
    await expect(lookupCep("00000000")).rejects.toBeInstanceOf(CepNotFoundError);
  });

  it("tolerates a payload with no street, so a CEP that covers a whole city still fills", async () => {
    stubFetch(() => jsonResponse({ localidade: "Belém", uf: "PA" }));

    await expect(lookupCep("66000000")).resolves.toEqual({
      street: "",
      district: "",
      city: "Belém",
      state: "PA",
    });
  });

  it("reports a network failure without leaking the raw fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(lookupCep("01310100")).rejects.toThrow("Não foi possível consultar o CEP.");
  });

  it("propagates an abort so a stale lookup never overwrites newer input", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    );

    await expect(lookupCep("01310100", controller.signal)).rejects.toBeInstanceOf(DOMException);
  });
});
