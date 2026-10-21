import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VALID_USER, installFakeApi, makeOrder, seedSession } from "../test/fakeApi";
import { renderApp } from "../test/renderApp";

describe("login e proteção de rota", () => {
  it("redireciona visitante sem sessão para o login ao abrir rota protegida", async () => {
    const api = installFakeApi();
    renderApp("/orders/new");

    expect(await screen.findByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Novo pedido" })).toBeNull();
    expect(api.calls).toHaveLength(0);
  });

  it("após login válido volta para a rota que o visitante tentou abrir", async () => {
    const api = installFakeApi();
    const { user } = renderApp("/orders/new");

    await user.type(await screen.findByLabelText("E-mail"), VALID_USER.email);
    await user.type(screen.getByLabelText("Senha"), VALID_USER.password);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Novo pedido" })).toBeTruthy();
    expect(api.calls[0]).toMatchObject({ method: "POST", path: "/auth/login", body: VALID_USER });
  });

  it("login sem rota de origem leva ao quadro e as chamadas seguintes usam o token", async () => {
    const api = installFakeApi([makeOrder()]);
    const { user } = renderApp("/login");

    await user.type(await screen.findByLabelText("E-mail"), VALID_USER.email);
    await user.type(screen.getByLabelText("Senha"), VALID_USER.password);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Pedidos" })).toBeTruthy();
    expect(await screen.findByText("Bruno Lima")).toBeTruthy();
    const orderCalls = api.calls.filter((c) => c.path.startsWith("/orders"));
    expect(orderCalls.length).toBeGreaterThan(0);
    expect(orderCalls.every((c) => c.authorization === "Bearer token-valido")).toBe(true);
  });

  it("credenciais inválidas mostram erro e mantêm o usuário no login", async () => {
    installFakeApi();
    const { user } = renderApp("/login");

    await user.type(await screen.findByLabelText("E-mail"), VALID_USER.email);
    await user.type(screen.getByLabelText("Senha"), "errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
  });

  it("campos vazios não chamam a API", async () => {
    const api = installFakeApi();
    const { user } = renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe seu e-mail.")).toBeTruthy();
    expect(screen.getByText("Informe sua senha.")).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it("sessão expirada no servidor devolve o usuário ao login com aviso", async () => {
    seedSession();
    const api = installFakeApi([makeOrder()]);
    api.expireSession();
    renderApp("/");

    expect(await screen.findByText("Sua sessão expirou. Entre novamente.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(localStorage.getItem("foody.auth")).toBeNull();
  });

  it("sair encerra a sessão e bloqueia o quadro", async () => {
    seedSession();
    installFakeApi();
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(localStorage.getItem("foody.auth")).toBeNull();
  });
});
