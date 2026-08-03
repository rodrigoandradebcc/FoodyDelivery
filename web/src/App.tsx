import type { CSSProperties } from "react";

/**
 * Placeholder shell for the "kitchen pass" board. Task 4 replaces this with
 * the router + auth layout; until then it doubles as a live specimen of the
 * design tokens, so a broken font or palette load is visible immediately.
 */

type Status =
  | "RECEBIDO"
  | "EM_PREPARO"
  | "SAIU_PARA_ENTREGA"
  | "ENTREGUE"
  | "CANCELADO";

const STATUS_LABEL: Record<Status, string> = {
  RECEBIDO: "Recebido",
  EM_PREPARO: "Em preparo",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

const STATUS_CLASS: Record<Status, string> = {
  RECEBIDO: "badge-recebido",
  EM_PREPARO: "badge-em-preparo",
  SAIU_PARA_ENTREGA: "badge-saiu",
  ENTREGUE: "badge-entregue",
  CANCELADO: "badge-cancelado",
};

const PIPELINE: Status[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
];

/** Ticket glyph — SVG, never emoji. */
function TicketIcon() {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7Z" />
      <path d="M12 7v2M12 13v2" strokeDasharray="1 3" />
    </svg>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge ${STATUS_CLASS[status]}`}>
      <svg
        className="icon icon-sm"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="5" />
      </svg>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function App() {
  return (
    <div style={{ maxWidth: "60rem", margin: "0 auto", padding: "var(--sp-6) var(--sp-4)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          marginBottom: "var(--sp-2)",
          color: "var(--accent)",
        }}
      >
        <TicketIcon />
        <h1 style={{ color: "var(--ink)" }}>Foody</h1>
      </header>

      <p className="muted" style={{ marginBottom: "var(--sp-6)" }}>
        Quadro de pedidos — em construção.
      </p>

      <section aria-labelledby="legenda" style={{ marginBottom: "var(--sp-6)" }}>
        <h2 id="legenda" style={{ marginBottom: "var(--sp-3)" }}>
          Etapas do pedido
        </h2>
        <ul
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--sp-2)",
            listStyle: "none",
            padding: 0,
          }}
        >
          {PIPELINE.map((status, i) => (
            <li
              key={status}
              className="rise"
              style={{ "--i": i } as CSSProperties}
            >
              <StatusBadge status={status} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="exemplo">
        <h2 id="exemplo" style={{ marginBottom: "var(--sp-3)" }}>
          Ticket
        </h2>
        <div
          className="card rise"
          style={{ padding: "var(--sp-4)", maxWidth: "20rem" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--sp-2)",
            }}
          >
            <span className="mono">#1042</span>
            <StatusBadge status="EM_PREPARO" />
          </div>
          <p className="muted" style={{ marginTop: "var(--sp-2)" }}>
            2 × Pizza margherita
          </p>
          <div className="tear">
            <strong className="mono">R$ 89,90</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
