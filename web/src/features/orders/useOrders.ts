import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/http";
import { listOrders, updateOrderStatus } from "../../api/orders";
import type { OrderStatus } from "../../api/types";

export function useOrdersByStatus(status: OrderStatus) {
  return useQuery({
    queryKey: ["orders", status],
    queryFn: () => listOrders({ status, size: 100 }),
    refetchInterval: 15_000,
  });
}

export function useStatusMutation(onApiError: (e: ApiError) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateOrderStatus(id, status),
    onError: (err) => {
      if (err instanceof ApiError) onApiError(err);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });
}
