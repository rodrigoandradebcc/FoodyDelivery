import { FormProvider, useForm } from "react-hook-form";
import { Link } from "react-router";
import PageHeader from "../../components/PageHeader";
import AddressFieldset from "./newOrder/AddressFieldset";
import CustomerField from "./newOrder/CustomerField";
import ItemsFieldset from "./newOrder/ItemsFieldset";
import OrderSummary from "./newOrder/OrderSummary";
import { useCreateOrder } from "./newOrder/useCreateOrder";
import { NEW_ORDER_DEFAULTS, type NewOrderForm } from "./newOrderForm";
import "./neworder.css";

export default function NewOrderPage() {
  const form = useForm<NewOrderForm>({
    mode: "onBlur",
    defaultValues: NEW_ORDER_DEFAULTS,
  });
  const { submit, isPending } = useCreateOrder(form.setError);
  const formError = form.formState.errors.root?.serverError?.message;

  return (
    <FormProvider {...form}>
      <form className="neworder" onSubmit={form.handleSubmit(submit)} noValidate>
        <PageHeader
          title="Novo pedido"
          eyebrow={
            <Link className="back-link" to="/">
              Voltar ao quadro
            </Link>
          }
        />
        <p className="no-lede">
          Preços em reais, como você digitaria na comanda — "45,90". O total é calculado
          enquanto você escreve.
        </p>

        {formError && (
          <p className="alert" role="alert">
            {formError}
          </p>
        )}

        <CustomerField />
        <ItemsFieldset />
        <AddressFieldset />
        <OrderSummary isSubmitting={isPending} />
      </form>
    </FormProvider>
  );
}
