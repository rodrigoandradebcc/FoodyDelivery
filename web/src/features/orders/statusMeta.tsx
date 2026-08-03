import type { ReactElement } from "react";
import type { OrderStatus } from "../../api/types";

function icon(path: ReactElement) {
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
      {path}
    </svg>
  );
}

export const STATUS_META: Record<
  OrderStatus,
  { label: string; ink: string; bg: string; icon: ReactElement }
> = {
  RECEBIDO: {
    label: "Recebido",
    ink: "var(--st-recebido-ink)",
    bg: "var(--st-recebido-bg)",
    icon: icon(
      <>
        <path d="M2 9h3l2 2.5h2L11 9h3" />
        <path d="M2 9V4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5V9v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9Z" />
      </>,
    ),
  },
  EM_PREPARO: {
    label: "Em preparo",
    ink: "var(--st-em-preparo-ink)",
    bg: "var(--st-em-preparo-bg)",
    icon: icon(
      <>
        <path d="M8 2c1.8 1.6 2.6 3 2.6 4.4A2.6 2.6 0 0 1 8 9a2.6 2.6 0 0 1-2.6-2.6C5.4 5 6.2 3.6 8 2Z" />
        <path d="M4 12.5h8M5 12.5V14M11 12.5V14" />
      </>,
    ),
  },
  SAIU_PARA_ENTREGA: {
    label: "Saiu para entrega",
    ink: "var(--st-saiu-ink)",
    bg: "var(--st-saiu-bg)",
    icon: icon(
      <>
        <circle cx="4.5" cy="11.5" r="2" />
        <circle cx="11.5" cy="11.5" r="2" />
        <path d="M4.5 11.5 7 6h3l1.5 5.5M7 6H5.5" />
      </>,
    ),
  },
  ENTREGUE: {
    label: "Entregue",
    ink: "var(--st-entregue-ink)",
    bg: "var(--st-entregue-bg)",
    icon: icon(
      <>
        <circle cx="8" cy="8" r="6" />
        <path d="m5.5 8 1.8 1.8L10.8 6.2" />
      </>,
    ),
  },
  CANCELADO: {
    label: "Cancelado",
    ink: "var(--st-cancelado-ink)",
    bg: "var(--st-cancelado-bg)",
    icon: icon(
      <>
        <circle cx="8" cy="8" r="6" />
        <path d="m6 6 4 4M10 6l-4 4" />
      </>,
    ),
  },
};

export const PIPELINE: readonly OrderStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
] as const;

export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  RECEBIDO: "EM_PREPARO",
  EM_PREPARO: "SAIU_PARA_ENTREGA",
  SAIU_PARA_ENTREGA: "ENTREGUE",
  ENTREGUE: null,
  CANCELADO: null,
};

export const ADVANCE_LABEL: Record<OrderStatus, string | null> = {
  RECEBIDO: "Iniciar preparo",
  EM_PREPARO: "Despachar entrega",
  SAIU_PARA_ENTREGA: "Confirmar entrega",
  ENTREGUE: null,
  CANCELADO: null,
};

export const CAN_CANCEL: Record<OrderStatus, boolean> = {
  RECEBIDO: true,
  EM_PREPARO: true,
  SAIU_PARA_ENTREGA: false,
  ENTREGUE: false,
  CANCELADO: false,
};
