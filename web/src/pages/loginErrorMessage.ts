import { ApiError } from "../api/http";

export function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) return "E-mail ou senha incorretos.";
  return err instanceof Error ? err.message : "Erro inesperado.";
}
