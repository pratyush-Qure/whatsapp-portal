/**
 * Normalize phone to E.164 format (digits only with leading +).
 * Strips non-digit characters except leading +.
 */
export function formatPhoneNumber(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (!digits) return s;
  return digits.startsWith("+") ? s : `+${digits}`;
}

/**
 * Mask phone for logs — never log full numbers. Format: +91XXXXX12345 (country + last 4).
 */
export function maskPhoneForLog(phone: string): string {
  if (!phone || typeof phone !== "string") return "***";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  const last4 = digits.slice(-4);
  const rest = digits.slice(0, -4);
  return `+${rest.replace(/\d/g, "X")}${last4}`;
}
