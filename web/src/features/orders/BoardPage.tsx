import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { Column } from "./Column";
import { MobileBoard } from "./MobileBoard";
import { PIPELINE } from "./statusMeta";
import "./board.css";

export default function BoardPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
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
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="board-page">
      <h1 className="board-title">Pedidos</h1>
      <p className="board-lede">
        Cada pedido segue as quatro etapas abaixo. Cancelar tira o pedido do fluxo — os
        cancelados ficam na última coluna do quadro.
      </p>

      {isDesktop ? (
        <>
          <div className="board-columns">
            {PIPELINE.map((status) => (
              <Column key={status} status={status} notify={setToast} />
            ))}
            <Column status="CANCELADO" notify={setToast} />
          </div>
        </>
      ) : (
        <MobileBoard notify={setToast} />
      )}

      <div aria-live="polite" className="toast-region">
        {toast && <p className="toast">{toast}</p>}
      </div>
    </div>
  );
}
