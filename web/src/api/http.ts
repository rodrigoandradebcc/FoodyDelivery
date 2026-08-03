import type { FieldError, ProblemDetail } from "./types";

const BASE: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail | null;

  constructor(status: number, problem: ProblemDetail | null) {
    super(problem?.detail ?? problem?.title ?? `Erro HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }

  get fieldErrors(): FieldError[] {
    return this.problem?.errors ?? [];
  }
}

let tokenProvider: () => string | null = () => null;
let unauthorizedHandler: () => void = () => {};

export function setTokenProvider(fn: () => string | null): void {
  tokenProvider = fn;
}

export function setOnUnauthorized(fn: () => void): void {
  unauthorizedHandler = fn;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

function hasJsonBody(res: Response): boolean {
  return (res.headers.get("content-type") ?? "").includes("json");
}

export async function request<T = unknown>(
  path: string,
  { method = "GET", body, auth = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, {
      title: "API indisponível",
      detail: `Não foi possível conectar à API em ${BASE}. O backend está rodando?`,
    });
  }

  if (!res.ok) {
    let problem: ProblemDetail | null = null;
    if (hasJsonBody(res)) {
      problem = (await res.json().catch(() => null)) as ProblemDetail | null;
    }

    if (res.status === 401 && auth) unauthorizedHandler();

    throw new ApiError(res.status, problem);
  }

  if (!hasJsonBody(res)) return undefined as T;
  return (await res.json()) as T;
}
