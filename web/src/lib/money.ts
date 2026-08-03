const PARSE_RE = /^\d+(\.\d{1,2})?$/;
const NOISE_RE = /[R$\s.]/g;

export function formatCentsBRL(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.trunc(abs / 100).toLocaleString("pt-BR");
  const centavos = String(abs % 100).padStart(2, "0");
  return `${sign}R$ ${reais},${centavos}`;
}

export function parseBRLToCents(input: string): number | null {
  const cleaned = input.trim().replace(NOISE_RE, "").replace(",", ".");
  if (!PARSE_RE.test(cleaned)) return null;

  const [reais, frac = ""] = cleaned.split(".");
  return Number(reais) * 100 + Number((frac + "00").slice(0, 2));
}
