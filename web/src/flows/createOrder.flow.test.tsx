import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { installFakeApi, seedSession } from "../test/fakeApi";
import { renderApp } from "../test/renderApp";

describe("criação de pedido", () => {
  it("preenche o formulário, envia o pedido e mostra no quadro", async () => {
    seedSession();
    const api = installFakeApi();
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("link", { name: "Novo pedido" }));
    await screen.findByRole("heading", { name: "Novo pedido" });

    await user.type(screen.getByLabelText("Cliente"), "  Carla Souza  ");
    await user.type(screen.getByLabelText("Produto"), "Pizza calabresa");
    await user.type(screen.getByLabelText("Preço unit. (R$)"), "45,90");
    await user.clear(screen.getByLabelText("Qtde."));
    await user.type(screen.getByLabelText("Qtde."), "2");

    await user.click(screen.getByRole("button", { name: "Adicionar item" }));
    const names = screen.getAllByLabelText("Produto");
    const prices = screen.getAllByLabelText("Preço unit. (R$)");
    await user.type(names[1], "Refrigerante");
    await user.type(prices[1], "8");

    expect(screen.getByText("Total · 3 itens")).toBeTruthy();

    await user.type(screen.getByLabelText("CEP"), "01001000");
    expect(await screen.findByDisplayValue("Praça da Sé")).toBeTruthy();
    expect((screen.getByLabelText("UF") as HTMLSelectElement).value).toBe("SP");
    await user.type(screen.getByLabelText("Número"), "100");

    await user.click(screen.getByRole("button", { name: "Criar pedido" }));

    expect(await screen.findByText("Pedido criado.")).toBeTruthy();
    const post = api.calls.find((c) => c.method === "POST" && c.path === "/orders");
    expect(post?.body).toEqual({
      customerName: "Carla Souza",
      items: [
        { productName: "Pizza calabresa", unitPriceCents: 4590, quantity: 2 },
        { productName: "Refrigerante", unitPriceCents: 800, quantity: 1 },
      ],
      deliveryAddress: {
        street: "Praça da Sé",
        number: "100",
        complement: null,
        district: "Sé",
        city: "São Paulo",
        state: "SP",
        zipCode: "01001000",
      },
    });

    const received = screen.getByRole("region", { name: "Recebido" });
    expect(await within(received).findByText("Carla Souza")).toBeTruthy();
  });

  it("não envia pedido inválido e aponta os campos com erro", async () => {
    seedSession();
    const api = installFakeApi();
    const { user } = renderApp("/orders/new");

    await screen.findByRole("heading", { name: "Novo pedido" });
    await user.type(screen.getByLabelText("Preço unit. (R$)"), "abc");
    await user.clear(screen.getByLabelText("Qtde."));
    await user.type(screen.getByLabelText("Qtde."), "1.5");
    await user.click(screen.getByRole("button", { name: "Criar pedido" }));

    expect(await screen.findByText("Quantidade deve ser um inteiro de 1 a 1000.")).toBeTruthy();
    expect(screen.getByText("Preço inválido — máximo R$ 1.000.000,00 e até 2 decimais.")).toBeTruthy();
    expect(screen.getByText("CEP deve ter 8 dígitos.")).toBeTruthy();
    expect(screen.getByLabelText("Cliente").getAttribute("aria-invalid")).toBe("true");
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });
});
