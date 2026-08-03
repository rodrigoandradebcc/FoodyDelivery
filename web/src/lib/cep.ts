const NON_DIGIT_RE = /\D/g;

export function stripCep(input: string): string {
  return input.replace(NON_DIGIT_RE, "").slice(0, 8);
}

export function maskCep(digits: string): string {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
