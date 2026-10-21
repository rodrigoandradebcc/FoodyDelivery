import { useCallback, useState } from "react";
import type { ApiError } from "../../api/http";
import { statusErrorMessage } from "./statusErrorMessage";

export function useStatusMutationError() {
  const [mutationError, setMutationError] = useState<string | null>(null);

  const onChangeStart = useCallback(() => setMutationError(null), []);
  const onError = useCallback(
    (error: ApiError) => setMutationError(statusErrorMessage(error, "pedido")),
    [],
  );

  return { mutationError, onChangeStart, onError };
}
