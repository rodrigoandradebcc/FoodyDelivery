import type { ItemRow, NewOrderForm } from "./newOrderForm";

export const EMPTY_ITEM: ItemRow = { productName: "", price: "", quantity: "1" };

export const NEW_ORDER_DEFAULTS: NewOrderForm = {
  customerName: "",
  items: [{ ...EMPTY_ITEM }],
  deliveryAddress: {
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    zipCode: "",
  },
};
