import _get from "lodash/get";

/**
 * Get a value from an object using dot-notation path (e.g. "phone", "customer.phone", "data.0.amount").
 * Returns undefined if path not found.
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || obj == null) return undefined;
  const trimmed = String(path).trim();
  if (!trimmed) return undefined;
  try {
    return _get(obj as object, trimmed);
  } catch {
    return undefined;
  }
}
