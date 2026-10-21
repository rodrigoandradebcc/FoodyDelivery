import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../api/http";
import { getOrder } from "../../api/orders";

export function useOrderDetail(id: string | undefined) {
  const query = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => getOrder(id ?? ""),
    enabled: Boolean(id),
  });

  const notFound = query.error instanceof ApiError && query.error.status === 404;
  const loadErrorMessage = query.error instanceof Error ? query.error.message : "Tente novamente.";

  return { query, order: query.data, notFound, loadErrorMessage };
}
