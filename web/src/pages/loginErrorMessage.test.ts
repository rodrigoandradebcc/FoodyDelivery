import { describe, expect, it } from "vitest";
import { ApiError } from "../api/http";
import { loginErrorMessage } from "./loginErrorMessage";

describe("loginErrorMessage", () => {
  it("explains wrong credentials for a 401", () => {
    expect(loginErrorMessage(new ApiError(401, null))).toBe("E-mail ou senha incorretos.");
  });

  it("uses the error message for other ApiErrors", () => {
    expect(loginErrorMessage(new ApiError(500, { detail: "Indisponível." }))).toBe("Indisponível.");
  });

  it("uses the message of a plain Error", () => {
    expect(loginErrorMessage(new Error("Sem conexão."))).toBe("Sem conexão.");
  });

  it("falls back to 'Erro inesperado.' for a non-Error value", () => {
    expect(loginErrorMessage(42)).toBe("Erro inesperado.");
  });
});
