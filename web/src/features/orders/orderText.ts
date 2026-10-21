import type { ApiError } from "../../api/http";

export function statusErrorMessage(error: ApiError, subject: "quadro" | "pedido"): string {
  return error.status === 409
    ? `Transição inválida — o ${subject} foi atualizado.`
    : error.message;
}

export function extraItemsLabel(count: number): string {
  return `+${count} ${count === 1 ? "item" : "itens"}`;
}
