const encoder = new TextEncoder();

const MAX_PASSWORD_BYTES = 72;

export function isPasswordWithinLimit(value: string): boolean {
  return value.length <= MAX_PASSWORD_BYTES && encoder.encode(value).length <= MAX_PASSWORD_BYTES;
}
