import { request } from "./http";
import type { CreateOrderRequest, OrderResponse, OrderStatus, PageResponse } from "./types";

export interface ListOrdersParams {
  status?: OrderStatus;
  /** >= 0 */
  page?: number;
  /** 1..100 */
  size?: number;
}

export function listOrders(params: ListOrdersParams = {}): Promise<PageResponse<OrderResponse>> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.page !== undefined) q.set("page", String(params.page));
  if (params.size !== undefined) q.set("size", String(params.size));
  const qs = q.toString();
  return request<PageResponse<OrderResponse>>(`/orders${qs ? `?${qs}` : ""}`);
}

/**
 * 201 Created with a Location header AND the full OrderResponse in the body.
 * Returning it lets the caller seed the cache instead of forcing an immediate
 * refetch; callers that only care about success can ignore the value.
 */
export function createOrder(req: CreateOrderRequest): Promise<OrderResponse> {
  return request<OrderResponse>("/orders", { method: "POST", body: req });
}

export function getOrder(id: string): Promise<OrderResponse> {
  return request<OrderResponse>(`/orders/${encodeURIComponent(id)}`);
}

/** 200 with the updated order; 409 if the status transition is illegal. */
export function updateOrderStatus(id: string, status: OrderStatus): Promise<OrderResponse> {
  return request<OrderResponse>(`/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
}
