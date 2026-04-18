import type { FieldDef, FieldType } from "../types.ts";

export interface FieldValidationResult {
  valid: boolean;
  message?: string;
  expected?: string;
  actual?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}(:\d{2})?$/;
// Accepts ISO 8601 datetime with optional timezone
const ISO_DATETIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

export function validateFieldValue(
  value: unknown,
  def: FieldDef
): FieldValidationResult {
  if (value === null || value === undefined) {
    if (def.required) {
      return { valid: false, message: "Field is required", expected: def.type, actual: "null" };
    }
    return { valid: true };
  }
  return validateByType(value, def);
}

function validateByType(value: unknown, def: FieldDef): FieldValidationResult {
  switch (def.type) {
    case "string": return validateString(value, def);
    case "integer": return validateInteger(value, def);
    case "number": return validateNumber(value, def);
    case "boolean": return validateBoolean(value);
    case "date": return validateDate(value);
    case "datetime": return validateDatetime(value);
    case "time": return validateTime(value);
    case "enum": return validateEnum(value, def);
    case "list": return validateList(value, def);
    case "object": return validateObject(value, def);
    case "link": return validateLink(value);
    case "tags": return validateTags(value);
    case "any": return { valid: true };
    default:
      return { valid: false, message: `Unknown field type: ${String(def.type)}` };
  }
}

function validateString(value: unknown, def: FieldDef): FieldValidationResult {
  if (typeof value !== "string") {
    return { valid: false, message: "Expected a string", expected: "string", actual: typeof value };
  }
  if (def.min_length !== undefined && value.length < def.min_length) {
    return {
      valid: false,
      message: `String too short (min ${def.min_length} chars)`,
      expected: `length >= ${def.min_length}`,
      actual: String(value.length),
    };
  }
  if (def.max_length !== undefined && value.length > def.max_length) {
    return {
      valid: false,
      message: `String too long (max ${def.max_length} chars)`,
      expected: `length <= ${def.max_length}`,
      actual: String(value.length),
    };
  }
  if (def.pattern) {
    try {
      if (!new RegExp(def.pattern).test(value)) {
        return {
          valid: false,
          message: `String does not match pattern /${def.pattern}/`,
          expected: def.pattern,
          actual: value,
        };
      }
    } catch {
      return { valid: false, message: `Invalid pattern: ${def.pattern}` };
    }
  }
  return { valid: true };
}

function validateInteger(value: unknown, def: FieldDef): FieldValidationResult {
  const coerced = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(coerced)) {
    return { valid: false, message: "Expected an integer", expected: "integer", actual: typeof value };
  }
  const n = coerced as number;
  if (def.min !== undefined && n < def.min) {
    return { valid: false, message: `Value too small (min ${def.min})`, expected: `>= ${def.min}`, actual: String(n) };
  }
  if (def.max !== undefined && n > def.max) {
    return { valid: false, message: `Value too large (max ${def.max})`, expected: `<= ${def.max}`, actual: String(n) };
  }
  return { valid: true };
}

function validateNumber(value: unknown, def: FieldDef): FieldValidationResult {
  const coerced = typeof value === "string" ? Number(value) : value;
  if (typeof coerced !== "number" || isNaN(coerced)) {
    return { valid: false, message: "Expected a number", expected: "number", actual: typeof value };
  }
  if (def.min !== undefined && coerced < def.min) {
    return { valid: false, message: `Value too small (min ${def.min})`, expected: `>= ${def.min}`, actual: String(coerced) };
  }
  if (def.max !== undefined && coerced > def.max) {
    return { valid: false, message: `Value too large (max ${def.max})`, expected: `<= ${def.max}`, actual: String(coerced) };
  }
  return { valid: true };
}

function validateBoolean(value: unknown): FieldValidationResult {
  if (typeof value !== "boolean") {
    return { valid: false, message: "Expected a boolean", expected: "boolean", actual: typeof value };
  }
  return { valid: true };
}

function validateDate(value: unknown): FieldValidationResult {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    return {
      valid: false,
      message: "Expected a date in YYYY-MM-DD format",
      expected: "YYYY-MM-DD",
      actual: String(value),
    };
  }
  return { valid: true };
}

function validateDatetime(value: unknown): FieldValidationResult {
  const s = typeof value === "string" ? value : value instanceof Date ? value.toISOString() : null;
  if (!s || !ISO_DATETIME.test(s)) {
    return {
      valid: false,
      message: "Expected an ISO 8601 datetime",
      expected: "ISO 8601 datetime",
      actual: String(value),
    };
  }
  return { valid: true };
}

function validateTime(value: unknown): FieldValidationResult {
  if (typeof value !== "string" || !ISO_TIME.test(value)) {
    return {
      valid: false,
      message: "Expected a time in HH:MM or HH:MM:SS format",
      expected: "HH:MM or HH:MM:SS",
      actual: String(value),
    };
  }
  return { valid: true };
}

function validateEnum(value: unknown, def: FieldDef): FieldValidationResult {
  if (!def.values || def.values.length === 0) {
    return { valid: false, message: "Enum type has no defined values" };
  }
  if (!def.values.includes(String(value))) {
    return {
      valid: false,
      message: `Invalid enum value. Allowed: ${def.values.join(", ")}`,
      expected: def.values.join(" | "),
      actual: String(value),
    };
  }
  return { valid: true };
}

function validateList(value: unknown, def: FieldDef): FieldValidationResult {
  if (!Array.isArray(value)) {
    return { valid: false, message: "Expected a list", expected: "list", actual: typeof value };
  }
  if (def.min_items !== undefined && value.length < def.min_items) {
    return { valid: false, message: `List too short (min ${def.min_items} items)` };
  }
  if (def.max_items !== undefined && value.length > def.max_items) {
    return { valid: false, message: `List too long (max ${def.max_items} items)` };
  }
  if (def.element_type && def.element_type !== "any") {
    for (let i = 0; i < value.length; i++) {
      const result = validateByType(value[i], { type: def.element_type });
      if (!result.valid) {
        return {
          valid: false,
          message: `List item [${i}]: ${result.message}`,
          expected: def.element_type,
          actual: typeof value[i],
        };
      }
    }
  }
  if (def.unique_elements) {
    const serialized = value.map((v) => JSON.stringify(v));
    const unique = new Set(serialized);
    if (unique.size !== serialized.length) {
      return { valid: false, message: "List must contain unique elements" };
    }
  }
  return { valid: true };
}

function validateObject(value: unknown, def: FieldDef): FieldValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { valid: false, message: "Expected an object", expected: "object", actual: typeof value };
  }
  if (def.fields) {
    for (const [key, fieldDef] of Object.entries(def.fields)) {
      const fieldValue = (value as Record<string, unknown>)[key];
      const result = validateFieldValue(fieldValue, fieldDef);
      if (!result.valid) {
        return { valid: false, message: `Field "${key}": ${result.message}` };
      }
    }
  }
  return { valid: true };
}

function validateLink(value: unknown): FieldValidationResult {
  // Level 4 handles deep link resolution; here we just check it's a string
  if (typeof value !== "string") {
    return { valid: false, message: "Expected a link string", expected: "link", actual: typeof value };
  }
  return { valid: true };
}

function validateTags(value: unknown): FieldValidationResult {
  if (!Array.isArray(value)) {
    return { valid: false, message: "Expected a list of tags", expected: "tags (list)", actual: typeof value };
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== "string") {
      return { valid: false, message: `Tag [${i}] is not a string` };
    }
  }
  return { valid: true };
}

export const FIELD_TYPES: FieldType[] = [
  "string", "integer", "number", "boolean", "date", "datetime",
  "time", "enum", "list", "object", "link", "tags", "any",
];
