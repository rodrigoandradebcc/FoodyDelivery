import { useFieldArray, useFormContext } from "react-hook-form";
import PlusIcon from "../../../components/icons/PlusIcon";
import { EMPTY_ITEM, type NewOrderForm } from "../newOrderForm";
import { validateItemCount } from "../neworderValidation";
import ItemRowFields from "./ItemRowFields";

export default function ItemsFieldset() {
  const {
    control,
    formState: { errors },
  } = useFormContext<NewOrderForm>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
    rules: { validate: (items) => validateItemCount(items.length) },
  });

  return (
    <fieldset className="no-section card">
      <legend>
        <span className="no-step" aria-hidden="true">1</span>
        Itens
      </legend>
      {errors.items?.root && (
        <span className="field-error" role="alert">{errors.items.root.message}</span>
      )}
      {fields.map((field, i) => (
        <ItemRowFields
          key={field.id}
          index={i}
          removable={fields.length > 1}
          onRemove={() => remove(i)}
        />
      ))}
      <button
        type="button"
        className="btn btn-ghost no-item-add"
        disabled={fields.length >= 100}
        onClick={() => append({ ...EMPTY_ITEM })}
      >
        <PlusIcon />
        Adicionar item
      </button>
    </fieldset>
  );
}
