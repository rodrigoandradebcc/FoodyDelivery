import type { OrderStatus } from "../../api/types";
import { PIPELINE } from "./statusMeta";

export const TABS: readonly OrderStatus[] = [...PIPELINE, "CANCELADO"];

export function isStatus(value: string | null): value is OrderStatus {
  return value !== null && (TABS as readonly string[]).includes(value);
}
