import { request } from "./http";
import type { CreateOrderRequest, OrderResponse, OrderStatus, PageResponse } from "./types";

export interface Order extends OrderResponse {
  customerName: string;
}

export interface ListOrdersParams {
  status?: OrderStatus;

  page?: number;

  size?: number;
}

export function listOrders(params: ListOrdersParams = {}): Promise<PageResponse<Order>> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.page !== undefined) q.set("page", String(params.page));
  if (params.size !== undefined) q.set("size", String(params.size));
  const qs = q.toString();
  return request<PageResponse<Order>>(`/orders${qs ? `?${qs}` : ""}`);
}

export function createOrder(req: CreateOrderRequest): Promise<Order> {
  return request<Order>("/orders", { method: "POST", body: req });
}

export function getOrder(id: string): Promise<Order> {
  return request<Order>(`/orders/${encodeURIComponent(id)}`);
}

export function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return request<Order>(`/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
}
