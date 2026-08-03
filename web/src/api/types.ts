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

export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
}

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

  expiresIn: number;
}

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

  state: string;

  zipCode: string;
}

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
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
