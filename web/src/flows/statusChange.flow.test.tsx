import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { installFakeApi, makeOrder, seedSession } from "../test/fakeApi";
import { renderApp } from "../test/renderApp";

describe("mudança de status", () => {
  it("avança o pedido pelas etapas até entregue", async () => {
    seedSession();
    const api = installFakeApi([makeOrder()]);
    const { user } = renderApp("/");

    await within(screen.getByRole("region", { name: "Recebido" })).findByText("Bruno Lima");

    await user.click(await screen.findByRole("button", { name: "Iniciar preparo para pedido de Bruno Lima" }));
    await within(screen.getByRole("region", { name: "Em preparo" })).findByText("Bruno Lima");

    await user.click(await screen.findByRole("button", { name: "Despachar entrega para pedido de Bruno Lima" }));
    await within(screen.getByRole("region", { name: "Saiu para entrega" })).findByText("Bruno Lima");

    await user.click(await screen.findByRole("button", { name: "Confirmar entrega para pedido de Bruno Lima" }));
    const delivered = screen.getByRole("region", { name: "Entregue" });
    await within(delivered).findByText("Bruno Lima");
    expect(within(delivered).queryByRole("button", { name: /Cancelar pedido/ })).toBeNull();

    const patches = api.calls.filter((c) => c.method === "PATCH").map((c) => c.body);
    expect(patches).toEqual([{ status: "EM_PREPARO" }, { status: "SAIU_PARA_ENTREGA" }, { status: "ENTREGUE" }]);
  });

  it("cancela o pedido somente após confirmação", async () => {
    seedSession();
    const api = installFakeApi([makeOrder({ status: "SAIU_PARA_ENTREGA" })]);
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Cancelar pedido de Bruno Lima" }));
    expect(api.calls.some((c) => c.method === "PATCH")).toBe(false);

    const back = screen.getByRole("button", { name: "Voltar para ações do pedido de Bruno Lima" });
    expect(document.activeElement).toBe(back);
    await user.click(back);
    expect(api.calls.some((c) => c.method === "PATCH")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Cancelar pedido de Bruno Lima" }));
    await user.click(screen.getByRole("button", { name: "Confirmar cancelamento do pedido de Bruno Lima" }));

    await within(screen.getByRole("region", { name: "Cancelado" })).findByText("Bruno Lima");
    expect(api.calls.filter((c) => c.method === "PATCH").map((c) => c.body)).toEqual([{ status: "CANCELADO" }]);
  });

  it("muda o status pela página de detalhe", async () => {
    seedSession();
    const order = makeOrder();
    installFakeApi([order]);
    const { user } = renderApp(`/orders/${order.id}`);

    await user.click(await screen.findByRole("button", { name: "Iniciar preparo para pedido de Bruno Lima" }));

    expect(await screen.findByRole("button", { name: "Despachar entrega para pedido de Bruno Lima" })).toBeTruthy();
    expect(screen.getAllByText("Em preparo").length).toBeGreaterThan(0);
  });
});
