import type { SubmitHandler, UseFormSetError } from "react-hook-form";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import type { LoginForm } from "./loginForm";
import { loginErrorMessage } from "./loginErrorMessage";

export function useLoginSubmit(setError: UseFormSetError<LoginForm>) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const onSubmit: SubmitHandler<LoginForm> = async ({ email, password }) => {
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError("root.serverError", { message: loginErrorMessage(err) });
    }
  };

  return { from, onSubmit };
}
