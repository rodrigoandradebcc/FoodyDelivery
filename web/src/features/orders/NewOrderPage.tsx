import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
  type SubmitHandler,
} from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { ApiError } from "../../api/http";
import { createOrder } from "../../api/orders";
import type { CreateOrderRequest } from "../../api/types";
import { CepNotFoundError, lookupCep } from "../../api/viacep";
import { maskCep, stripCep } from "../../lib/cep";
import { formatCentsBRL, parseBRLToCents } from "../../lib/money";
import "./neworder.css";

type CepStatus = "idle" | "loading" | "filled";

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

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

function LiveTotal({ control }: { control: Control<NewOrderForm> }) {
  const items = useWatch({ control, name: "items" });
  const rows = items ?? [];
  const totalCents = rows.reduce((sum, row) => {
    const cents = parseBRLToCents(row?.price ?? "");
    const qty = parseQuantity(row?.quantity ?? "");
    return cents !== null && Number.isInteger(qty) && qty >= 1 ? sum + cents * qty : sum;
  }, 0);
  const units = rows.reduce((sum, row) => {
    const qty = parseQuantity(row?.quantity ?? "");
    return Number.isInteger(qty) && qty >= 1 ? sum + qty : sum;
  }, 0);

  return (
    <div className="no-total-block">
      <span className="no-total-label">
        Total · {units} {units === 1 ? "item" : "itens"}
      </span>
      <strong className="mono no-total">{formatCentsBRL(totalCents)}</strong>
    </div>
  );
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");
  const cepRequest = useRef<AbortController | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    clearErrors,
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

  useEffect(() => () => cepRequest.current?.abort(), []);

  async function fillFromCep(digits: string) {
    cepRequest.current?.abort();
    if (digits.length !== 8) {
      setCepStatus("idle");
      return;
    }

    const controller = new AbortController();
    cepRequest.current = controller;
    setCepStatus("loading");
    clearErrors("deliveryAddress.zipCode");

    try {
      const addr = await lookupCep(digits, controller.signal);
      setValue("deliveryAddress.street", addr.street, { shouldValidate: true });
      setValue("deliveryAddress.district", addr.district, { shouldValidate: true });
      setValue("deliveryAddress.city", addr.city, { shouldValidate: true });
      setValue("deliveryAddress.state", addr.state, { shouldValidate: true });
      setCepStatus("filled");
      setFocus("deliveryAddress.number");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setCepStatus("idle");
      setError("deliveryAddress.zipCode", {
        message:
          err instanceof CepNotFoundError
            ? "CEP não encontrado. Preencha o endereço manualmente."
            : "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
      });
    }
  }

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
      <header className="no-head">
        <Link to="/" className="no-back">
          Voltar ao quadro
        </Link>
        <h1>Novo pedido</h1>
        <p className="no-lede">
          Preços em reais, como você digitaria na comanda — "45,90". O total é calculado
          enquanto você escreve.
        </p>
      </header>

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
              {fields.length > 1 && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger-ghost no-item-remove"
                  onClick={() => remove(i)}
                >
                  Remover
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn-sm btn-ghost no-item-add"
          onClick={() => append({ ...EMPTY_ITEM })}
        >
          <PlusIcon />
          Adicionar item
        </button>
      </fieldset>

      <fieldset className="no-section card">
        <legend>Endereço de entrega</legend>
        <div className="no-addr-grid">
          <div className="field no-cep">
            <label htmlFor="deliveryAddress.zipCode">CEP</label>
            <Controller
              control={control}
              name="deliveryAddress.zipCode"
              rules={{ validate: (v) => v.length === 8 || "CEP deve ter 8 dígitos." }}
              render={({ field }) => {
                function handleCepChange(event: ChangeEvent<HTMLInputElement>) {
                  const digits = stripCep(event.target.value);
                  field.onChange(digits);
                  void fillFromCep(digits);
                }

                return (
                  <input
                    id="deliveryAddress.zipCode"
                    inputMode="numeric"
                    placeholder="00000-000"
                    autoComplete="postal-code"
                    aria-invalid={!!addressErrors?.zipCode}
                    aria-describedby="cep-status"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={maskCep(field.value)}
                    onChange={handleCepChange}
                  />
                );
              }}
            />
            <span id="cep-status" role="status" className="field-hint">
              {cepStatus === "loading" && "Buscando endereço…"}
              {cepStatus === "filled" && !addressErrors?.zipCode && "Endereço preenchido pelo ViaCEP."}
              {cepStatus === "idle" && !addressErrors?.zipCode && "Preenche o endereço automaticamente."}
            </span>
            {addressErrors?.zipCode && (
              <span className="field-error" role="alert">
                {addressErrors.zipCode.message}
              </span>
            )}
          </div>
          <div className="field no-street">
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
          <div className="field no-number">
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
          <div className="field no-complement">
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
          <div className="field no-district">
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
          <div className="field no-city">
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
          <div className="field no-uf">
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
