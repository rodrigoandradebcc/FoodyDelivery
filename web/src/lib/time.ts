/**
 * Relative timestamps for order cards ("há 5 minutos").
 * The formatter is built once at module load rather than per render —
 * Intl constructors are expensive and this one is called for every card.
 */
const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  // Guard first: Intl.RelativeTimeFormat#format throws RangeError on NaN, and
  // an unparseable createdAt must not take down the whole board.
  if (Number.isNaN(then)) return "";

  const diffMin = Math.round((then - Date.now()) / 60_000);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");

  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return rtf.format(diffH, "hour");

  return rtf.format(Math.round(diffH / 24), "day");
}
