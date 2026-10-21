export function cardEnterDelayMs(index: number): number {
  return Math.min(index, 8) * 30;
}
