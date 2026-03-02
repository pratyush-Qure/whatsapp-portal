import { getValueByPath } from "@/lib/utils/jsonpath";
import { formatPhoneNumber } from "@/lib/utils/phone";

/** Thrown when a required template variable has no value in the payload. */
export class MissingVariableError extends Error {
  constructor(
    public readonly variableName: string,
    public readonly payloadPath: string | null,
    public readonly position: number
  ) {
    super(
      payloadPath
        ? `Required variable "${variableName}" (payload path: ${payloadPath}) is missing or empty`
        : `Required variable "${variableName}" (position ${position}) is missing or empty`
    );
    this.name = "MissingVariableError";
  }
}

/** Thrown when payload is missing one or more required variable paths (validation before resolve). */
export class VariableValidationError extends Error {
  constructor(
    message: string,
    public readonly missing: ReadonlyArray<{ payload_path: string; variable_name: string }>
  ) {
    super(message);
    this.name = "VariableValidationError";
  }
}

export type ValidatePayloadResult = {
  valid: boolean;
  missing: Array<{ payload_path: string; variable_name: string }>;
};

type TemplateVariableForValidation = {
  name: string;
  source: string;
  payload_path: string | null;
  required: boolean;
};

/**
 * Validates that payload contains all required template variables (payload source).
 * Returns all missing keys so the API can return a single 400 with full list.
 */
export function validatePayloadVariables(
  variables: TemplateVariableForValidation[],
  payload: unknown
): ValidatePayloadResult {
  const missing: Array<{ payload_path: string; variable_name: string }> = [];

  for (const variable of variables) {
    if (variable.source !== "payload" || !variable.required) continue;
    const path = variable.payload_path;
    if (!path) continue;

    const value = getValueByPath(payload, path);
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");
    if (isEmpty) {
      missing.push({ payload_path: path, variable_name: variable.name });
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

export type ResolvedVariable = {
  position: number;
  value: string;
};

type TemplateVariable = {
  position: number;
  name: string;
  type: "text" | "number" | "date" | "url" | "phone";
  source: "payload" | "static" | "computed";
  payload_path: string | null;
  static_value: string | null;
  compute_expr: string | null;
  required: boolean;
};

type Template = {
  id: string;
  body: string;
};

function formatValue(value: unknown, type: TemplateVariable["type"]): string {
  if (value === undefined || value === null) return "";

  switch (type) {
    case "date":
      try {
        const d = new Date(value as string | number);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return String(value);
      }
    case "number":
      return Number(value).toLocaleString("en-US");
    case "phone":
      return formatPhoneNumber(value);
    case "url":
    case "text":
    default:
      return String(value);
  }
}

export async function resolveTemplateVariables(
  template: Template,
  variables: TemplateVariable[],
  payload: unknown
): Promise<ResolvedVariable[]> {
  const result: ResolvedVariable[] = [];

  for (const variable of variables.sort((a, b) => a.position - b.position)) {
    let value: unknown;

    switch (variable.source) {
      case "payload":
        value = variable.payload_path
          ? getValueByPath(payload, variable.payload_path)
          : undefined;
        break;
      case "static":
        value = variable.static_value ?? undefined;
        break;
      case "computed":
        value = undefined;
        if (variable.compute_expr) {
          try {
            const fn = new Function("payload", `return (${variable.compute_expr})`);
            value = fn(payload);
          } catch {
            value = undefined;
          }
        }
        break;
      default:
        value = undefined;
    }

    const formatted = formatValue(value, variable.type);

    if (variable.required && !formatted) {
      throw new MissingVariableError(
        variable.name,
        variable.payload_path ?? null,
        variable.position
      );
    }

    result.push({ position: variable.position, value: formatted });
  }

  return result;
}

export function interpolateTemplate(
  body: string,
  resolvedVariables: ResolvedVariable[]
): string {
  let result = body;
  for (const { position, value } of resolvedVariables) {
    result = result.replace(new RegExp(`\\{\\{${position}\\}\\}`, "g"), value);
  }
  return result;
}
