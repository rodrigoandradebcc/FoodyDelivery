import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import AuthBand from "./AuthBand";
import { isPasswordWithinLimit } from "./passwordBytes";
import type { RegisterForm } from "./registerErrors";
import { useRegisterSubmit } from "./useRegisterSubmit";
import "./auth.css";

export default function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ mode: "onBlur" });

  const onSubmit = useRegisterSubmit(setError);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const formError = errors.root?.serverError?.message;

  return (
    <div className="auth-page">
      <AuthBand />
      <main className="auth-card card">
        <p className="auth-sub">Crie sua conta para registrar pedidos.</p>

        {formError && (
          <p className="alert" role="alert">
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
                    isPasswordWithinLimit(value) ||
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
          <button type="submit" className="btn btn-primary btn-pill btn-lg auth-submit" disabled={isSubmitting}>
            {isSubmitting ? "Criando conta…" : "Criar conta"}
          </button>
        </form>

        <p className="auth-alt">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </main>
    </div>
  );
}
