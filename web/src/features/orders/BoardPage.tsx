import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { CanceledTray } from "./CanceledTray";
import { Column } from "./Column";
import { PIPELINE } from "./statusMeta";
import "./board.css";

export default function BoardPage() {
  const location = useLocation();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if ((location.state as { created?: boolean } | null)?.created) {
      setToast("Pedido criado.");
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="board-page">
      <h1 className="board-title">Pedidos</h1>

      <div className="board-columns">
        {PIPELINE.map((status) => (
          <Column key={status} status={status} notify={setToast} />
        ))}
      </div>

      <CanceledTray notify={setToast} />

      <div aria-live="polite" className="toast-region">
        {toast && <p className="toast">{toast}</p>}
      </div>
    </div>
  );
}
