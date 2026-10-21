import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import { ThemeToggle } from "../components/ThemeToggle";
import { AuthBand } from "./AuthBand";
import type { LoginForm } from "./loginForm";
import { useLoginRedirect } from "./useLoginRedirect";
import { useLoginSubmit } from "./useLoginSubmit";
import "./auth.css";

export default function LoginPage() {
  const { isAuthenticated, sessionExpired } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ mode: "onBlur" });

  const from = useLoginRedirect();
  const onSubmit = useLoginSubmit(setError);

  if (isAuthenticated) return <Navigate to={from} replace />;

  const formError = errors.root?.serverError?.message;

  return (
    <div className="auth-page">
      <AuthBand />
      <main className="auth-card card">
        <ThemeToggle className="auth-theme-toggle" labelClassName="visually-hidden" />
        <p className="auth-sub">Entre para acompanhar o quadro de pedidos.</p>

        {sessionExpired && (
          <output className="alert alert-info">
            Sua sessão expirou. Entre novamente.
          </output>
        )}
        {formError && (
          <p className="alert" role="alert">
            {formError}
          </p>
        )}

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email", { required: "Informe seu e-mail." })}
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
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register("password", { required: "Informe sua senha." })}
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
            {errors.password && (
              <span className="field-error" role="alert">
                {errors.password.message}
              </span>
            )}
          </div>
          <button type="submit" className="btn btn-primary btn-pill btn-lg auth-submit" disabled={isSubmitting}>
            {isSubmitting ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="auth-alt">
          Primeira vez aqui? <Link to="/register">Crie sua conta</Link>
        </p>
      </main>
    </div>
  );
}
