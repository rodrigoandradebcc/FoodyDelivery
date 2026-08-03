import { useMutation } from "@tanstack/react-query";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
  type SubmitHandler,
} from "react-hook-form";
import { useNavigate } from "react-router";
import { ApiError } from "../../api/http";
import { createOrder } from "../../api/orders";
import type { CreateOrderRequest } from "../../api/types";
import { maskCep, stripCep } from "../../lib/cep";
import { formatCentsBRL, parseBRLToCents } from "../../lib/money";
import "./neworder.css";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RO", "RR", "RS", "SC", "SP", "SE", "TO",
];

interface ItemRow {
  productName: string;
  price: string;
  quantity: string;
}

interface NewOrderForm {
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

const EMPTY_ITEM: ItemRow = { productName: "", price: "", quantity: "1" };

const ITEM_FIELD_ALIAS: Record<string, keyof ItemRow> = {
  productName: "productName",
  unitPriceCents: "price",
  quantity: "quantity",
};

const ITEM_PATH_RE = /^items\[(\d+)]\.(\w+)$/;

function toFormPath(apiField: string): FieldPath<NewOrderForm> | null {
  const match = ITEM_PATH_RE.exec(apiField);
  if (match) {
    const alias = ITEM_FIELD_ALIAS[match[2]];
    return alias ? (`items.${match[1]}.${alias}` as FieldPath<NewOrderForm>) : null;
  }
  if (apiField.startsWith("deliveryAddress.")) {
    return apiField as FieldPath<NewOrderForm>;
  }
  return null;
}

function parseQuantity(value: string): number {
  return Number.parseInt(value, 10);
}

function LiveTotal({ control }: { control: Control<NewOrderForm> }) {
  const items = useWatch({ control, name: "items" });
  const totalCents = (items ?? []).reduce((sum, row) => {
    const cents = parseBRLToCents(row?.price ?? "");
    const qty = parseQuantity(row?.quantity ?? "");
    return cents !== null && Number.isInteger(qty) && qty >= 1 ? sum + cents * qty : sum;
  }, 0);

  return (
    <span>
      Total: <strong className="mono no-total">{formatCentsBRL(totalCents)}</strong>
    </span>
  );
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<NewOrderForm>({
    mode: "onBlur",
    defaultValues: {
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
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const mutation = useMutation({
    mutationFn: (req: CreateOrderRequest) => createOrder(req),
    onSuccess: () => navigate("/", { state: { created: true } }),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors.length > 0) {
        let focused = false;
        for (const fe of err.fieldErrors) {
          const path = toFormPath(fe.field);
          if (path) {
            setError(path, { message: fe.message }, { shouldFocus: !focused });
            focused = true;
          } else {
            setError("root.serverError", { message: fe.message });
          }
        }
      } else {
        setError("root.serverError", {
          message: err instanceof Error ? err.message : "Erro inesperado.",
        });
      }
    },
  });

  const onSubmit: SubmitHandler<NewOrderForm> = (form) => {
    const addr = form.deliveryAddress;
    const complement = addr.complement.trim();
    mutation.mutate({
      items: form.items.map((row) => ({
        productName: row.productName.trim(),
        unitPriceCents: parseBRLToCents(row.price) ?? 0,
        quantity: parseQuantity(row.quantity),
      })),
      deliveryAddress: {
        street: addr.street.trim(),
        number: addr.number.trim(),
        complement: complement === "" ? null : complement,
        district: addr.district.trim(),
        city: addr.city.trim(),
        state: addr.state,
        zipCode: addr.zipCode,
      },
    });
  };

  const formError = errors.root?.serverError?.message;
  const addressErrors = errors.deliveryAddress;

  return (
    <form className="neworder" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h1>Novo pedido</h1>
      {formError && (
        <p className="auth-alert" role="alert">
          {formError}
        </p>
      )}

      <fieldset className="no-section card">
        <legend>Itens</legend>
        {fields.map((field, i) => {
          const itemErrors = errors.items?.[i];
          return (
            <div className="no-item-row" key={field.id}>
              <div className="field no-item-name">
                <label htmlFor={`items.${i}.productName`}>Produto</label>
                <input
                  id={`items.${i}.productName`}
                  aria-invalid={!!itemErrors?.productName}
                  {...register(`items.${i}.productName`, {
                    validate: (v) => v.trim() !== "" || "Informe o produto.",
                  })}
                />
                {itemErrors?.productName && (
                  <span className="field-error" role="alert">
                    {itemErrors.productName.message}
                  </span>
                )}
              </div>
              <div className="field no-item-price">
                <label htmlFor={`items.${i}.price`}>Preço unit. (R$)</label>
                <input
                  id={`items.${i}.price`}
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-invalid={!!itemErrors?.price}
                  {...register(`items.${i}.price`, {
                    validate: (value) =>
                      parseBRLToCents(value) !== null || "Preço inválido — use 0,00.",
                  })}
                />
                {itemErrors?.price && (
                  <span className="field-error" role="alert">
                    {itemErrors.price.message}
                  </span>
                )}
              </div>
              <div className="field no-item-qty">
                <label htmlFor={`items.${i}.quantity`}>Qtde.</label>
                <input
                  id={`items.${i}.quantity`}
                  inputMode="numeric"
                  aria-invalid={!!itemErrors?.quantity}
                  {...register(`items.${i}.quantity`, {
                    validate: (value) => {
                      const qty = parseQuantity(value);
                      return (Number.isInteger(qty) && qty >= 1) || "Quantidade mínima: 1.";
                    },
                  })}
                />
                {itemErrors?.quantity && (
                  <span className="field-error" role="alert">
                    {itemErrors.quantity.message}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-danger-ghost no-item-remove"
                disabled={fields.length === 1}
                onClick={() => remove(i)}
              >
                Remover
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => append({ ...EMPTY_ITEM })}
        >
          + Adicionar item
        </button>
      </fieldset>

      <fieldset className="no-section card">
        <legend>Endereço de entrega</legend>
        <div className="no-addr-grid">
          <div className="field no-span2">
            <label htmlFor="deliveryAddress.street">Rua</label>
            <input
              id="deliveryAddress.street"
              maxLength={150}
              autoComplete="street-address"
              aria-invalid={!!addressErrors?.street}
              {...register("deliveryAddress.street", {
                required: "Informe a rua.",
                maxLength: { value: 150, message: "Máximo de 150 caracteres." },
              })}
            />
            {addressErrors?.street && (
              <span className="field-error" role="alert">
                {addressErrors.street.message}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.number">Número</label>
            <input
              id="deliveryAddress.number"
              maxLength={20}
              aria-invalid={!!addressErrors?.number}
              {...register("deliveryAddress.number", {
                required: "Informe o número.",
                maxLength: { value: 20, message: "Máximo de 20 caracteres." },
              })}
            />
            {addressErrors?.number && (
              <span className="field-error" role="alert">
                {addressErrors.number.message}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.complement">Complemento (opcional)</label>
            <input
              id="deliveryAddress.complement"
              maxLength={150}
              aria-invalid={!!addressErrors?.complement}
              {...register("deliveryAddress.complement", {
                maxLength: { value: 150, message: "Máximo de 150 caracteres." },
              })}
            />
            {addressErrors?.complement && (
              <span className="field-error" role="alert">
                {addressErrors.complement.message}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.district">Bairro</label>
            <input
              id="deliveryAddress.district"
              maxLength={100}
              aria-invalid={!!addressErrors?.district}
              {...register("deliveryAddress.district", {
                required: "Informe o bairro.",
                maxLength: { value: 100, message: "Máximo de 100 caracteres." },
              })}
            />
            {addressErrors?.district && (
              <span className="field-error" role="alert">
                {addressErrors.district.message}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.city">Cidade</label>
            <input
              id="deliveryAddress.city"
              maxLength={100}
              autoComplete="address-level2"
              aria-invalid={!!addressErrors?.city}
              {...register("deliveryAddress.city", {
                required: "Informe a cidade.",
                maxLength: { value: 100, message: "Máximo de 100 caracteres." },
              })}
            />
            {addressErrors?.city && (
              <span className="field-error" role="alert">
                {addressErrors.city.message}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.state">UF</label>
            <select
              id="deliveryAddress.state"
              aria-invalid={!!addressErrors?.state}
              {...register("deliveryAddress.state", { required: "Selecione a UF." })}
            >
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {addressErrors?.state && (
              <span className="field-error" role="alert">
                {addressErrors.state.message}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="deliveryAddress.zipCode">CEP</label>
            <Controller
              control={control}
              name="deliveryAddress.zipCode"
              rules={{ validate: (v) => v.length === 8 || "CEP deve ter 8 dígitos." }}
              render={({ field }) => (
                <input
                  id="deliveryAddress.zipCode"
                  inputMode="numeric"
                  placeholder="00000-000"
                  autoComplete="postal-code"
                  aria-invalid={!!addressErrors?.zipCode}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={maskCep(field.value)}
                  onChange={(e) => field.onChange(stripCep(e.target.value))}
                />
              )}
            />
            {addressErrors?.zipCode && (
              <span className="field-error" role="alert">
                {addressErrors.zipCode.message}
              </span>
            )}
          </div>
        </div>
      </fieldset>

      <div className="no-footer">
        <LiveTotal control={control} />
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Enviando…" : "Criar pedido"}
        </button>
      </div>
    </form>
  );
}
