import { useQuery } from "@tanstack/react-query";
import { getOrder } from "../../api/orders";

export function useOrderDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => getOrder(id ?? ""),
    enabled: Boolean(id),
  });
}
