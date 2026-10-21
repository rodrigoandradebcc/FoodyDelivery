import { useFormContext } from "react-hook-form";
import type { NewOrderForm } from "../newOrderForm";
import { validateRequiredText } from "../neworderValidation";

export default function CustomerField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<NewOrderForm>();

  return (
    <div className="no-section card no-customer">
      <div className="field">
        <label htmlFor="customerName">Cliente</label>
        <input
          id="customerName"
          maxLength={120}
          autoComplete="name"
          aria-invalid={!!errors.customerName}
          {...register("customerName", {
            validate: (value) => validateRequiredText(value, "o cliente"),
          })}
        />
        {errors.customerName && (
          <span className="field-error" role="alert">{errors.customerName.message}</span>
        )}
      </div>
    </div>
  );
}
