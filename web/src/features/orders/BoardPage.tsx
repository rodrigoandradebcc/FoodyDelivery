import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import PageHeader from "../../components/PageHeader";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { Column } from "./Column";
import { MobileBoard } from "./MobileBoard";
import { PIPELINE } from "./statusMeta";
import "./board.css";

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

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
      <PageHeader title="Pedidos" />
      <div className="board-toolbar">
        <p className="board-lede">
          Cada pedido segue as quatro etapas abaixo. Cancelar tira o pedido do fluxo — os
          cancelados ficam na última coluna do quadro.
        </p>
        <Link to="/orders/new" className="btn btn-primary btn-pill btn-lg">
          <PlusIcon />
          Novo pedido
        </Link>
      </div>

      {isDesktop ? (
        <div
          className="board-columns"
          tabIndex={0}
          role="group"
          aria-label="Colunas de status"
        >
          {PIPELINE.map((status) => (
            <Column key={status} status={status} notify={setToast} />
          ))}
          <Column status="CANCELADO" notify={setToast} />
        </div>
      ) : (
        <MobileBoard notify={setToast} />
      )}

      <div aria-live="polite" className="toast-region">
        {toast && (
          <p className="toast">
            <CheckIcon />
            {toast}
          </p>
        )}
      </div>
    </div>
  );
}
