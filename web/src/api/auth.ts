import { request } from "./http";
import type { LoginRequest, LoginResponse, RegisterRequest, UserResponse } from "./types";

/**
 * Both calls pass `auth: false`. Beyond skipping a pointless Bearer header,
 * this is what tells the http layer that a 401 here means "bad credentials",
 * not "session expired" — so it will not fire the global logout handler and
 * bounce the user off the login form they are currently using.
 */

/** 201 on success; 409 if the e-mail is taken; 400 with `errors[]` on validation. */
export function register(req: RegisterRequest): Promise<UserResponse> {
  return request<UserResponse>("/auth/register", { method: "POST", body: req, auth: false });
}

/** 200 with the token; 401 with a ProblemDetail body on bad credentials. */
export function login(req: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", { method: "POST", body: req, auth: false });
}
