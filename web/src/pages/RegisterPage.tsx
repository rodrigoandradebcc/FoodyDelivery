import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router";
import { register as apiRegister } from "../api/auth";
import { ApiError } from "../api/http";
import { useAuth } from "../auth/auth";
import "./auth.css";

interface RegisterForm {
  name: string;
  email: string;
  password: string;
}

const FORM_FIELDS: readonly (keyof RegisterForm)[] = ["name", "email", "password"];

const encoder = new TextEncoder();

function isFormField(field: string): field is keyof RegisterForm {
  return (FORM_FIELDS as readonly string[]).includes(field);
}

export default function RegisterPage() {
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ mode: "onBlur" });

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit: SubmitHandler<RegisterForm> = async ({ name, email, password }) => {
    const cleanEmail = email.trim();
    try {
      await apiRegister({ name: name.trim(), email: cleanEmail, password });
      await signIn(cleanEmail, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("email", { message: "Este e-mail já está cadastrado." }, { shouldFocus: true });
      } else if (err instanceof ApiError && err.fieldErrors.length > 0) {
        for (const fe of err.fieldErrors) {
          if (isFormField(fe.field)) setError(fe.field, { message: fe.message });
          else setError("root.serverError", { message: fe.message });
        }
      } else {
        setError("root.serverError", {
          message: err instanceof Error ? err.message : "Erro inesperado.",
        });
      }
    }
  };

  const formError = errors.root?.serverError?.message;

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-brand">
          Foody<span>.</span>
        </h1>
        <p className="auth-sub">Crie sua conta para registrar pedidos.</p>

        {formError && (
          <p className="auth-alert" role="alert">
            {formError}
          </p>
        )}

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input
              id="name"
              autoComplete="name"
              maxLength={120}
              aria-invalid={!!errors.name}
              {...register("name", {
                required: "Informe seu nome.",
                maxLength: { value: 120, message: "Máximo de 120 caracteres." },
              })}
            />
            {errors.name && (
              <span className="field-error" role="alert">
                {errors.name.message}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={180}
              aria-invalid={!!errors.email}
              {...register("email", {
                required: "Informe seu e-mail.",
                maxLength: { value: 180, message: "Máximo de 180 caracteres." },
              })}
            />
            {errors.email && (
              <span className="field-error" role="alert">
                {errors.email.message}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <div className="pw-wrap">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby="password-hint"
                {...register("password", {
                  required: "Informe uma senha.",
                  minLength: {
                    value: 8,
                    message: "A senha precisa de pelo menos 8 caracteres.",
                  },
                  validate: (value) =>
                    (value.length <= 72 && encoder.encode(value).length <= 72) ||
                    "Senha muito longa (máximo de 72 caracteres/bytes).",
                })}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-pressed={showPw}
              >
                {showPw ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <span id="password-hint" className="field-hint">
              Entre 8 e 72 caracteres.
            </span>
            {errors.password && (
              <span className="field-error" role="alert">
                {errors.password.message}
              </span>
            )}
          </div>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Criando conta…" : "Criar conta"}
          </button>
        </form>

        <p className="auth-alt">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
