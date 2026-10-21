import { useMutation } from "@tanstack/react-query";
import type { FieldPath, UseFormSetError } from "react-hook-form";
import { useNavigate } from "react-router";
import { ApiError } from "../../../api/http";
import { createOrder } from "../../../api/orders";
import type { CreateOrderRequest } from "../../../api/types";
import type { NewOrderForm } from "../newOrderForm";
import { toFormErrorTarget } from "../neworderValidation";
import { toCreateOrderRequest } from "./toCreateOrderRequest";

export function useCreateOrder(setError: UseFormSetError<NewOrderForm>) {
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (req: CreateOrderRequest) => createOrder(req),
    onSuccess: () => navigate("/", { state: { created: true } }),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400 && err.fieldErrors.length > 0) {
        let focused = false;
        for (const fe of err.fieldErrors) {
          const path = toFormErrorTarget(fe.field);
          if (path) {
            const group = path.endsWith(".root");
            setError(path as FieldPath<NewOrderForm>, { message: fe.message }, { shouldFocus: !focused && !group });
            if (!group) focused = true;
          } else {
            setError("root.serverError", { message: fe.message });
          }
        }
      } else {
        setError("root.serverError", {
          message: err instanceof Error ? err.message : "Erro inesperado.",
        });
      }
    },
  });

  function submit(form: NewOrderForm) {
    mutation.mutate(toCreateOrderRequest(form));
  }

  return { submit, isPending: mutation.isPending };
}
