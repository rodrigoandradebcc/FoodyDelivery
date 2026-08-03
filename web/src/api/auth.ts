import { request } from "./http";
import type { LoginRequest, LoginResponse, RegisterRequest, UserResponse } from "./types";

export function register(req: RegisterRequest): Promise<UserResponse> {
  return request<UserResponse>("/auth/register", { method: "POST", body: req, auth: false });
}

export function login(req: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", { method: "POST", body: req, auth: false });
}
