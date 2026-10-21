import { describe, expect, it } from "vitest";
import { CAN_CANCEL, NEXT_STATUS } from "./statusMeta";

describe("status transitions", () => {
  it.each([
    ["RECEBIDO", "EM_PREPARO", true],
    ["EM_PREPARO", "SAIU_PARA_ENTREGA", true],
    ["SAIU_PARA_ENTREGA", "ENTREGUE", true],
    ["ENTREGUE", null, false],
    ["CANCELADO", null, false],
  ] as const)("offers valid actions from %s", (status, next, canCancel) => {
    expect(NEXT_STATUS[status]).toBe(next);
    expect(CAN_CANCEL[status]).toBe(canCancel);
  });
});
