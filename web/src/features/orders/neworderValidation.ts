const PRICE_RE = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
const QUANTITY_RE = /^\d+$/;
const ITEM_PATH_RE = /^items\[(\d+)]\.(productName|quantity|unitPriceCents)$/;

const ADDRESS_FIELDS = [
  "street", "number", "complement", "district", "city", "state", "zipCode",
] as const;

export function validateRequiredText(value: string, label: string): true | string {
  const length = value.trim().length;
  if (length === 0) return `Informe ${label}.`;
  if (length > 120) return "Máximo de 120 caracteres.";
  return true;
}

export function validateComplement(value: string): true | string {
  return value.trim().length <= 120 || "Máximo de 120 caracteres.";
}

export function validateItemCount(count: number): true | string {
  if (count < 1) return "Adicione ao menos um item.";
  if (count > 100) return "Máximo de 100 itens.";
  return true;
}

export function parseQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!QUANTITY_RE.test(trimmed)) return null;
  const quantity = Number(trimmed);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 1000 ? quantity : null;
}

export function parsePriceCents(value: string): number | null {
  const trimmed = value.trim();
  if (!PRICE_RE.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.replaceAll(".", "").split(",");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 100_000_000 ? cents : null;
}

export function validateState(value: string): true | string {
  return /^[A-Za-z]{2}$/.test(value) || "UF deve ter 2 letras.";
}

export function validateZipCode(value: string): true | string {
  return /^\d{8}$/.test(value) || "CEP deve ter 8 dígitos.";
}

export type ErrorTarget =
  | "customerName"
  | "items.root"
  | `items.${number}.${"productName" | "quantity" | "price"}`
  | "deliveryAddress.root"
  | `deliveryAddress.${typeof ADDRESS_FIELDS[number]}`;

export function toFormErrorTarget(field: string): ErrorTarget | null {
  if (field === "customerName") return field;
  if (field === "items") return "items.root";
  if (field === "deliveryAddress") return "deliveryAddress.root";

  const item = ITEM_PATH_RE.exec(field);
  if (item) {
    const name = item[2] === "unitPriceCents" ? "price" : item[2];
    return `items.${Number(item[1])}.${name}` as ErrorTarget;
  }

  if (field.startsWith("deliveryAddress.")) {
    const name = field.slice("deliveryAddress.".length);
    if (ADDRESS_FIELDS.some((part) => part === name)) {
      return field as ErrorTarget;
    }
  }

  return null;
}
