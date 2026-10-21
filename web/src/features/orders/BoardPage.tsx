import { Link } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { CheckIcon } from "../../components/icons/CheckIcon";
import { PlusIcon } from "../../components/icons/PlusIcon";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { Column } from "./Column";
import { MobileBoard } from "./MobileBoard";
import { PIPELINE } from "./statusMeta";
import { useBoardToast } from "./useBoardToast";
import "./board.css";

export default function BoardPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { toast, notify } = useBoardToast();

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
            <Column key={status} status={status} notify={notify} />
          ))}
          <Column status="CANCELADO" notify={notify} />
        </div>
      ) : (
        <MobileBoard notify={notify} />
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
