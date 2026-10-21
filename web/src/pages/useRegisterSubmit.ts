import type { SubmitHandler, UseFormSetError } from "react-hook-form";
import { useNavigate } from "react-router";
import { register as apiRegister } from "../api/auth";
import { useAuth } from "../auth/useAuth";
import { registerErrorTargets, type RegisterForm } from "./registerErrors";

export function useRegisterSubmit(setError: UseFormSetError<RegisterForm>) {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const onSubmit: SubmitHandler<RegisterForm> = async ({ name, email, password }) => {
    const cleanEmail = email.trim();
    try {
      await apiRegister({ name: name.trim(), email: cleanEmail, password });
      await signIn(cleanEmail, password);
      navigate("/", { replace: true });
    } catch (err) {
      for (const target of registerErrorTargets(err)) {
        if (target.kind === "field") {
          setError(target.field, { message: target.message }, { shouldFocus: target.focus });
        } else {
          setError("root.serverError", { message: target.message });
        }
      }
    }
  };

  return onSubmit;
}
