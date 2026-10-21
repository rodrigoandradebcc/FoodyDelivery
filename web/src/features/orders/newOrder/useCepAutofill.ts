import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { CepNotFoundError, lookupCep } from "../../../api/viacep";
import type { NewOrderForm } from "../newOrderForm";

export type CepStatus = "idle" | "loading" | "filled";

export function useCepAutofill() {
  const { setValue, setError, setFocus, clearErrors } = useFormContext<NewOrderForm>();
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");
  const cepRequest = useRef<AbortController | null>(null);

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

  return { cepStatus, fillFromCep };
}
