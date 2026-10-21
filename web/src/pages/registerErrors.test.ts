import { describe, expect, it } from "vitest";
import { ApiError } from "../api/http";
import { registerErrorTargets } from "./registerErrors";

describe("registerErrorTargets", () => {
  it("points a 409 at the email field and focuses it", () => {
    expect(registerErrorTargets(new ApiError(409, null))).toEqual([
      { kind: "field", field: "email", message: "Este e-mail já está cadastrado.", focus: true },
    ]);
  });

  it("maps form field errors to their fields without focus", () => {
    const err = new ApiError(400, {
      errors: [
        { field: "name", message: "Nome obrigatório." },
        { field: "password", message: "Senha curta." },
      ],
    });
    expect(registerErrorTargets(err)).toEqual([
      { kind: "field", field: "name", message: "Nome obrigatório.", focus: false },
      { kind: "field", field: "password", message: "Senha curta.", focus: false },
    ]);
  });

  it("sends an unknown field error to the root", () => {
    const err = new ApiError(400, { errors: [{ field: "cpf", message: "CPF inválido." }] });
    expect(registerErrorTargets(err)).toEqual([{ kind: "root", message: "CPF inválido." }]);
  });

  it("uses the error message as root for an ApiError without field errors", () => {
    const err = new ApiError(500, { detail: "Falha no servidor." });
    expect(registerErrorTargets(err)).toEqual([{ kind: "root", message: "Falha no servidor." }]);
  });

  it("uses the message of a plain Error as root", () => {
    expect(registerErrorTargets(new Error("Sem conexão."))).toEqual([
      { kind: "root", message: "Sem conexão." },
    ]);
  });

  it("falls back to 'Erro inesperado.' for a non-Error value", () => {
    expect(registerErrorTargets("boom")).toEqual([{ kind: "root", message: "Erro inesperado." }]);
  });
});
