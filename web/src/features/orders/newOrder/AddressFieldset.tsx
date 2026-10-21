import type { ChangeEvent } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { maskCep, stripCep } from "../../../lib/cep";
import type { NewOrderForm } from "../newOrderForm";
import {
  validateComplement,
  validateRequiredText,
  validateState,
  validateZipCode,
} from "../neworderValidation";
import { UFS } from "./ufs";
import { useCepAutofill } from "./useCepAutofill";

export function AddressFieldset() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<NewOrderForm>();
  const { cepStatus, fillFromCep } = useCepAutofill();
  const addressErrors = errors.deliveryAddress;

  return (
    <fieldset className="no-section card">
      <legend>
        <span className="no-step" aria-hidden="true">2</span>
        Endereço de entrega
      </legend>
      {addressErrors?.root && (
        <span className="field-error" role="alert">{addressErrors.root.message}</span>
      )}
      <div className="no-addr-grid">
        <div className="field no-cep">
          <label htmlFor="deliveryAddress.zipCode">CEP</label>
          <Controller
            control={control}
            name="deliveryAddress.zipCode"
            rules={{ validate: validateZipCode }}
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
            maxLength={120}
            autoComplete="street-address"
            aria-invalid={!!addressErrors?.street}
            {...register("deliveryAddress.street", {
              validate: (value) => validateRequiredText(value, "a rua"),
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
            maxLength={120}
            aria-invalid={!!addressErrors?.number}
            {...register("deliveryAddress.number", {
              validate: (value) => validateRequiredText(value, "o número"),
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
            maxLength={120}
            aria-invalid={!!addressErrors?.complement}
            {...register("deliveryAddress.complement", {
              validate: validateComplement,
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
            maxLength={120}
            aria-invalid={!!addressErrors?.district}
            {...register("deliveryAddress.district", {
              validate: (value) => validateRequiredText(value, "o bairro"),
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
            maxLength={120}
            autoComplete="address-level2"
            aria-invalid={!!addressErrors?.city}
            {...register("deliveryAddress.city", {
              validate: (value) => validateRequiredText(value, "a cidade"),
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
            {...register("deliveryAddress.state", { validate: validateState })}
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
  );
}
