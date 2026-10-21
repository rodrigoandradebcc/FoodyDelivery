export interface ItemRow {
  productName: string;
  price: string;
  quantity: string;
}

export interface NewOrderForm {
  customerName: string;
  items: ItemRow[];
  deliveryAddress: {
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

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
