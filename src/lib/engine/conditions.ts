import _includes from "lodash/includes";
import { getValueByPath } from "@/lib/utils/jsonpath";

type Condition = {
  field: string;
  op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "exists";
  value: unknown;
};

export type RuleTree = {
  and?: Condition[];
  or?: Condition[];
};

function evaluateCondition(payload: unknown, condition: Condition): boolean {
  const value = getValueByPath(payload, condition.field);

  switch (condition.op) {
    case "eq":
      return value === condition.value;
    case "ne":
      return value !== condition.value;
    case "gt":
      return typeof value === "number" && typeof condition.value === "number" && value > condition.value;
    case "gte":
      return typeof value === "number" && typeof condition.value === "number" && value >= condition.value;
    case "lt":
      return typeof value === "number" && typeof condition.value === "number" && value < condition.value;
    case "lte":
      return typeof value === "number" && typeof condition.value === "number" && value <= condition.value;
    case "in":
      return Array.isArray(condition.value) && _includes(condition.value, value);
    case "contains":
      return String(value).includes(String(condition.value));
    case "exists":
      return value !== undefined && value !== null;
    default:
      return false;
  }
}

export function evaluateConditions(payload: unknown, ruleTree: RuleTree | null | undefined): boolean {
  if (!ruleTree) return true;

  if (ruleTree.and && ruleTree.and.length > 0) {
    return ruleTree.and.every((c) => evaluateCondition(payload, c));
  }

  if (ruleTree.or && ruleTree.or.length > 0) {
    return ruleTree.or.some((c) => evaluateCondition(payload, c));
  }

  return true;
}
