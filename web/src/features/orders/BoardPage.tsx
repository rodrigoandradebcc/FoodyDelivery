import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { CanceledTray } from "./CanceledTray";
import { Column } from "./Column";
import { MobileBoard } from "./MobileBoard";
import { PIPELINE } from "./statusMeta";
import "./board.css";

export default function BoardPage() {
  const location = useLocation();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
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

      {isDesktop ? (
        <>
          <div className="board-columns">
            {PIPELINE.map((status) => (
              <Column key={status} status={status} notify={setToast} />
            ))}
          </div>
          <CanceledTray notify={setToast} />
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
