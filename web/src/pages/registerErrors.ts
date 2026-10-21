import { ApiError } from "../api/http";

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
}

type RegisterErrorTarget =
  | { kind: "field"; field: keyof RegisterForm; message: string; focus: boolean }
  | { kind: "root"; message: string };

const FORM_FIELDS: readonly (keyof RegisterForm)[] = ["name", "email", "password"];

function isFormField(field: string): field is keyof RegisterForm {
  return (FORM_FIELDS as readonly string[]).includes(field);
}

export function registerErrorTargets(err: unknown): RegisterErrorTarget[] {
  if (err instanceof ApiError && err.status === 409) {
    return [
      { kind: "field", field: "email", message: "Este e-mail já está cadastrado.", focus: true },
    ];
  }
  if (err instanceof ApiError && err.fieldErrors.length > 0) {
    return err.fieldErrors.map((fe): RegisterErrorTarget =>
      isFormField(fe.field)
        ? { kind: "field", field: fe.field, message: fe.message, focus: false }
        : { kind: "root", message: fe.message },
    );
  }
  return [{ kind: "root", message: err instanceof Error ? err.message : "Erro inesperado." }];
}
