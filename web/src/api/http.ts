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

  /** Validation errors from a 400, or [] for every other failure shape. */
  get fieldErrors(): FieldError[] {
    return this.problem?.errors ?? [];
  }
}

/**
 * Wired once by the auth layer at startup. The indirection is deliberate:
 * the fetch layer never imports React, so tokens can be read at call time
 * without every request closing over a render-scoped value or forcing the
 * query layer to re-create functions when auth state changes.
 */
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
  /**
   * false for /auth/* calls: no Bearer header is sent, and a 401 back means
   * "those credentials are wrong", not "your session expired" — so the
   * session-expiry handler must not fire.
   */
  auth?: boolean;
}

/** True when the response actually carries a JSON body worth parsing. */
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
    // fetch only rejects on network/CORS failure — there is no status to read.
    throw new ApiError(0, {
      title: "API indisponível",
      detail: `Não foi possível conectar à API em ${BASE}. O backend está rodando?`,
    });
  }

  if (!res.ok) {
    // There are TWO shapes of 401. Spring Security's filter chain rejects a
    // missing/malformed/expired token before any controller runs and answers
    // with an EMPTY body plus WWW-Authenticate: Bearer — res.json() would
    // throw SyntaxError there. A failed login reaches the app and returns a
    // real ProblemDetail. So: parse only when the content-type promises JSON,
    // and still tolerate a zero-length body behind that promise.
    let problem: ProblemDetail | null = null;
    if (hasJsonBody(res)) {
      problem = (await res.json().catch(() => null)) as ProblemDetail | null;
    }

    // Only an authenticated call can have an expired session.
    if (res.status === 401 && auth) unauthorizedHandler();

    throw new ApiError(res.status, problem);
  }

  // 201 Created (Location header) and 204 No Content carry nothing to parse.
  if (!hasJsonBody(res)) return undefined as T;
  return (await res.json()) as T;
}
