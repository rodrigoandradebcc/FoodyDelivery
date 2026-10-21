import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";

const TOAST_DURATION_MS = 4000;

export function useBoardToast() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if ((location.state as { created?: boolean } | null)?.created) {
      setToast("Pedido criado.");
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      window.history.replaceState({}, "");
    }
  }, [location.state, queryClient]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return { toast, notify: setToast };
}
