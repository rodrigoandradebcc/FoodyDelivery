import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ApiError } from "../api/http";
import { useAuth } from "../auth/auth";
import "./auth.css";

interface LoginForm {
  email: string;
  password: string;
}

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) return "E-mail ou senha incorretos.";
  return err instanceof Error ? err.message : "Erro inesperado.";
}

export default function LoginPage() {
  const { isAuthenticated, sessionExpired, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ mode: "onBlur" });

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit: SubmitHandler<LoginForm> = async ({ email, password }) => {
    try {
      await signIn(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? "/", {
        replace: true,
      });
    } catch (err) {
      setError("root.serverError", { message: loginErrorMessage(err) });
    }
  };

  const formError = errors.root?.serverError?.message;

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-brand">
          Foody<span>.</span>
        </h1>
        <p className="auth-sub">Entre para acompanhar o quadro de pedidos.</p>

        {sessionExpired && (
          <output className="auth-alert auth-alert-info">
            Sua sessão expirou. Entre novamente.
          </output>
        )}
        {formError && (
          <p className="auth-alert" role="alert">
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
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="auth-alt">
          Primeira vez aqui? <Link to="/register">Crie sua conta</Link>
        </p>
      </div>
    </div>
  );
}
