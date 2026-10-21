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
