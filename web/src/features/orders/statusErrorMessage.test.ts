import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/http";
import { statusErrorMessage } from "./statusErrorMessage";

describe("statusErrorMessage", () => {
  it("reports a stale board on a 409 conflict", () => {
    expect(statusErrorMessage(new ApiError(409, null), "quadro")).toBe(
      "Transição inválida — o quadro foi atualizado.",
    );
  });

  it("reports a stale order on a 409 conflict", () => {
    expect(statusErrorMessage(new ApiError(409, null), "pedido")).toBe(
      "Transição inválida — o pedido foi atualizado.",
    );
  });

  it("passes the error message through for other statuses", () => {
    expect(statusErrorMessage(new ApiError(422, { detail: "Status inválido." }), "pedido")).toBe(
      "Status inválido.",
    );
  });
});
