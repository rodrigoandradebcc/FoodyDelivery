/**
 * Money is ALWAYS integer cents — `unitPriceCents` and `totalCents` are
 * integers on the wire and must stay integers in the client.
 *
 * No float arithmetic appears anywhere in this module. Formatting splits the
 * value with integer division/modulo; parsing works purely on strings and
 * only calls Number() on digit groups that are already whole numbers.
 *
 * The reason is not pedantry: `parseFloat("49.90") * 100` evaluates to
 * 4989.999999999999, so a float round-trip silently bills the customer one
 * cent less on very ordinary prices.
 */

// Hoisted: these are hot on every keystroke of a price input (js-hoist-regexp).
// Neither carries the /g flag, so neither holds a mutable lastIndex.
const PARSE_RE = /^\d+(\.\d{1,2})?$/;
const NOISE_RE = /[R$\s.]/g;

/** 123456 -> "R$ 1.234,56". Accepts negatives for completeness. */
export function formatCentsBRL(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.trunc(abs / 100).toLocaleString("pt-BR");
  const centavos = String(abs % 100).padStart(2, "0");
  return `${sign}R$ ${reais},${centavos}`;
}

/**
 * "1.234,56" | "R$ 12,50" | "12" | "0,5" -> integer cents.
 * Returns null for anything that is not a non-negative pt-BR amount, so the
 * caller can surface a field error instead of sending NaN to the API.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.trim().replace(NOISE_RE, "").replace(",", ".");
  if (!PARSE_RE.test(cleaned)) return null;

  const [reais, frac = ""] = cleaned.split(".");
  // `frac` is 0-2 digits; right-pad so "5" reads as 50 centavos, not 5.
  return Number(reais) * 100 + Number((frac + "00").slice(0, 2));
}
