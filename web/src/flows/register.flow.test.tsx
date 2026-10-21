import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VALID_USER, installFakeApi } from "../test/fakeApi";
import { renderApp } from "../test/renderApp";

describe("cadastro de usuário", () => {
  it("cria a conta, entra automaticamente e abre o quadro", async () => {
    const api = installFakeApi();
    const { user } = renderApp("/register");

    await user.type(await screen.findByLabelText("Nome"), "  Rodrigo Andrade  ");
    await user.type(screen.getByLabelText("E-mail"), "  rodrigo@foody.dev  ");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByRole("heading", { name: "Pedidos" })).toBeTruthy();
    expect(api.calls[0]).toMatchObject({
      method: "POST",
      path: "/auth/register",
      body: { name: "Rodrigo Andrade", email: "rodrigo@foody.dev", password: "senha-forte-123" },
    });
    expect(api.calls[1]).toMatchObject({
      method: "POST",
      path: "/auth/login",
      body: { email: "rodrigo@foody.dev", password: "senha-forte-123" },
    });
    expect(localStorage.getItem("foody.auth")).not.toBeNull();
  });

  it("e-mail já cadastrado mostra o erro no campo e não faz login", async () => {
    const api = installFakeApi();
    const { user } = renderApp("/register");

    await user.type(await screen.findByLabelText("Nome"), "Ana");
    await user.type(screen.getByLabelText("E-mail"), VALID_USER.email.toUpperCase());
    await user.type(screen.getByLabelText("Senha"), "outra-senha-123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Este e-mail já está cadastrado.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("E-mail"));
    expect(api.calls.some((c) => c.path === "/auth/login")).toBe(false);
    expect(screen.queryByRole("heading", { name: "Pedidos" })).toBeNull();
  });

  it("campos vazios não chamam a API", async () => {
    const api = installFakeApi();
    const { user } = renderApp("/register");

    await user.click(await screen.findByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Informe seu nome.")).toBeTruthy();
    expect(screen.getByText("Informe seu e-mail.")).toBeTruthy();
    expect(screen.getByText("Informe uma senha.")).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it("senha curta é recusada antes de enviar", async () => {
    const api = installFakeApi();
    const { user } = renderApp("/register");

    await user.type(await screen.findByLabelText("Nome"), "Rodrigo");
    await user.type(screen.getByLabelText("E-mail"), "rodrigo@foody.dev");
    await user.type(screen.getByLabelText("Senha"), "123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("A senha precisa de pelo menos 8 caracteres.")).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });
});
