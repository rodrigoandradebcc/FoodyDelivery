import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { installFakeApi, seedSession } from "../test/fakeApi";
import { renderApp } from "../test/renderApp";

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("tema", () => {
  it("alterna entre escuro e claro e persiste a escolha", async () => {
    seedSession();
    installFakeApi([]);
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Ativar tema escuro" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("foody.theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Ativar tema claro" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("foody.theme")).toBe("light");
  });
});
