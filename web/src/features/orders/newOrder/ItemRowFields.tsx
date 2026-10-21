import { useFormContext } from "react-hook-form";
import type { NewOrderForm } from "../newOrderForm";
import { parsePriceCents, parseQuantity, validateRequiredText } from "../neworderValidation";

interface ItemRowFieldsProps {
  index: number;
  removable: boolean;
  onRemove: () => void;
}

export default function ItemRowFields({ index: i, removable, onRemove }: ItemRowFieldsProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<NewOrderForm>();
  const itemErrors = errors.items?.[i];

  return (
    <div className="no-item-row">
      <div className="field no-item-name">
        <label htmlFor={`items.${i}.productName`}>Produto</label>
        <input
          id={`items.${i}.productName`}
          aria-invalid={!!itemErrors?.productName}
          {...register(`items.${i}.productName`, {
            validate: (v) => validateRequiredText(v, "o produto"),
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
              parsePriceCents(value) !== null || "Preço inválido — máximo R$ 1.000.000,00 e até 2 decimais.",
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
            validate: (value) =>
              parseQuantity(value) !== null || "Quantidade deve ser um inteiro de 1 a 1000.",
          })}
        />
        {itemErrors?.quantity && (
          <span className="field-error" role="alert">
            {itemErrors.quantity.message}
          </span>
        )}
      </div>
      {removable && (
        <button
          type="button"
          className="btn btn-sm btn-danger-ghost no-item-remove"
          aria-label={`Remover item ${i + 1}`}
          onClick={onRemove}
        >
          Remover
        </button>
      )}
    </div>
  );
}
