/**
 * Wire types for the FoodyDelivery REST API (base http://localhost:8080/api/v1).
 * These mirror the Java DTOs exactly — do not "improve" field names here.
 */

export type OrderStatus =
  | "RECEBIDO"
  | "EM_PREPARO"
  | "SAIU_PARA_ENTREGA"
  | "ENTREGUE"
  | "CANCELADO";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
  "CANCELADO",
] as const;

/**
 * One entry of the RFC 7807 `errors` array on a 400.
 * `field` uses the server's nested path syntax verbatim — `items[0].quantity`,
 * `deliveryAddress.zipCode` — so forms can key inputs off it directly.
 */
export interface FieldError {
  field: string;
  message: string;
}

/** RFC 7807 ProblemDetail, plus the `errors` array Spring adds on validation failures. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
}

/** POST /auth/register — password is 8..72 chars AND <= 72 UTF-8 bytes. */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  /** Seconds. The API returns 3600. */
  expiresIn: number;
}

/** Money is integer cents. `unitPriceCents >= 0`, `quantity >= 1`. */
export interface OrderItem {
  productName: string;
  unitPriceCents: number;
  quantity: number;
}

export interface DeliveryAddress {
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  /** Exactly 2 characters, e.g. "SP". */
  state: string;
  /** Exactly 8 characters, digits only, NO mask. "01001-000" is rejected. */
  zipCode: string;
}

/** POST /orders — `items` must be non-empty with no null elements. */
export interface CreateOrderRequest {
  items: OrderItem[];
  deliveryAddress: DeliveryAddress;
}

export interface OrderResponse {
  id: string;
  status: OrderStatus;
  totalCents: number;
  items: OrderItem[];
  deliveryAddress: DeliveryAddress;
  createdAt: string;
  updatedAt: string;
  // NOTE: the API never returns the order's customer. Do not add UI for it.
}

/** GET /orders — `page >= 0`, `size` is 1..100. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
