/**
 * `zipCode` is exactly 8 characters with NO mask. The API rejects
 * "01001-000" outright, so the mask exists only for display: every value that
 * leaves for the wire goes through stripCep first.
 */

// Hoisted — runs on every keystroke of the CEP input (js-hoist-regexp).
const NON_DIGIT_RE = /\D/g;

/** Display value (or raw typing) -> exactly the digits, never more than 8. */
export function stripCep(input: string): string {
  return input.replace(NON_DIGIT_RE, "").slice(0, 8);
}

/** Digits -> "01310-100", masking progressively as the user types. */
export function maskCep(digits: string): string {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
