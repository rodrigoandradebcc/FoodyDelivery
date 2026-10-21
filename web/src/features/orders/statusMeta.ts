import { createElement, type ReactElement } from "react";
import type { OrderStatus } from "../../api/types";
import { RecebidoIcon } from "../../components/icons/RecebidoIcon";
import { EmPreparoIcon } from "../../components/icons/EmPreparoIcon";
import { SaiuParaEntregaIcon } from "../../components/icons/SaiuParaEntregaIcon";
import { EntregueIcon } from "../../components/icons/EntregueIcon";
import { CanceladoIcon } from "../../components/icons/CanceladoIcon";

export const STATUS_META: Record<
  OrderStatus,
  { label: string; icon: ReactElement }
> = {
  RECEBIDO: {
    label: "Recebido",
    icon: createElement(RecebidoIcon),
  },
  EM_PREPARO: {
    label: "Em preparo",
    icon: createElement(EmPreparoIcon),
  },
  SAIU_PARA_ENTREGA: {
    label: "Saiu para entrega",
    icon: createElement(SaiuParaEntregaIcon),
  },
  ENTREGUE: {
    label: "Entregue",
    icon: createElement(EntregueIcon),
  },
  CANCELADO: {
    label: "Cancelado",
    icon: createElement(CanceladoIcon),
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

export const EMPTY_HINT: Record<OrderStatus, string> = {
  RECEBIDO: "Nenhum pedido novo.",
  EM_PREPARO: "Nada na cozinha agora.",
  SAIU_PARA_ENTREGA: "Nenhuma entrega em rota.",
  ENTREGUE: "Nenhuma entrega concluída ainda.",
  CANCELADO: "Nenhum pedido cancelado.",
};

export const CAN_CANCEL: Record<OrderStatus, boolean> = {
  RECEBIDO: true,
  EM_PREPARO: true,
  SAIU_PARA_ENTREGA: true,
  ENTREGUE: false,
  CANCELADO: false,
};
