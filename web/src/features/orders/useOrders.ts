import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/http";
import { listOrders, updateOrderStatus } from "../../api/orders";
import type { OrderResponse, OrderStatus, PageResponse } from "../../api/types";

export function nextOrdersPage<T>(lastPage: PageResponse<T>) {
  const nextPage = lastPage.page + 1;
  return nextPage < lastPage.totalPages ? nextPage : undefined;
}

export function flattenOrderPages<T extends { id: string }>(pages: PageResponse<T>[]) {
  const seen = new Set<string>();
  return pages.flatMap((page) => page.content.filter((order) => {
    if (seen.has(order.id)) return false;
    seen.add(order.id);
    return true;
  }));
}

function selectOrders(data: { pages: PageResponse<OrderResponse>[]; pageParams: number[] }) {
  return {
    ...data,
    content: flattenOrderPages(data.pages),
    totalElements: data.pages[0]?.totalElements ?? 0,
  };
}

export function useOrdersByStatus(status: OrderStatus) {
  return useInfiniteQuery({
    queryKey: ["orders", status],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listOrders({ status, page: pageParam, size: 100 }),
    getNextPageParam: nextOrdersPage,
    select: selectOrders,
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
