import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../api/http";
import { getOrder } from "../../api/orders";
import { statusErrorMessage } from "./statusErrorMessage";

export function useOrderDetail(id: string | undefined) {
  const [mutationError, setMutationError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => getOrder(id ?? ""),
    enabled: Boolean(id),
  });

  const notFound = query.error instanceof ApiError && query.error.status === 404;
  const loadErrorMessage = query.error instanceof Error ? query.error.message : "Tente novamente.";

  return {
    query,
    order: query.data,
    notFound,
    loadErrorMessage,
    mutationError,
    onChangeStart: () => setMutationError(null),
    onError: (error: ApiError) => setMutationError(statusErrorMessage(error, "pedido")),
  };
}
