import type {
  MdbaseConfig,
  TypeDefinition,
  ValidationIssue,
} from "../types.ts";
import { getDefaultStrict, getDefaultValidation } from "../types.ts";
import { validateFieldValue } from "../schema/fieldTypes.ts";

const IMPLICIT_KEYS = new Set(["type", "types"]);

export function validateFile(
  filePath: string,
  frontmatter: Record<string, unknown>,
  matchedTypes: TypeDefinition[],
  config: MdbaseConfig,
): ValidationIssue[] {
  const mode = getDefaultValidation(config);
  if (mode === "off") return [];
  if (matchedTypes.length === 0) return [];

  const issues: ValidationIssue[] = [];

  for (const typeDef of matchedTypes) {
    const typeIssues = validateAgainstType(
      filePath,
      frontmatter,
      typeDef,
      config,
    );
    issues.push(...typeIssues);
  }

  return issues;
}

function validateAgainstType(
  filePath: string,
  frontmatter: Record<string, unknown>,
  typeDef: TypeDefinition,
  config: MdbaseConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fields = typeDef.fields ?? {};
  const strictMode = typeDef.strict ?? getDefaultStrict(config);

  // Validate declared fields
  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const value = frontmatter[fieldName];

    if ((value === undefined || value === null) && fieldDef.required) {
      issues.push({
        path: filePath,
        field: fieldName,
        code: "FIELD_REQUIRED",
        message: `Required field "${fieldName}" is missing`,
        severity: "error",
        type: typeDef.name,
      });
      continue;
    }

    if (value !== undefined && value !== null) {
      const result = validateFieldValue(value, fieldDef);
      if (!result.valid) {
        issues.push({
          path: filePath,
          field: fieldName,
          code: "TYPE_MISMATCH",
          message: result.message ?? `Invalid value for field "${fieldName}"`,
          severity: "error",
          expected: result.expected,
          actual: result.actual,
          type: typeDef.name,
        });
      }
    }
  }

  // Check for unknown fields per strict mode
  if (strictMode !== false) {
    const knownFields = new Set(Object.keys(fields));
    for (const key of Object.keys(frontmatter)) {
      if (IMPLICIT_KEYS.has(key) || knownFields.has(key)) continue;
      issues.push({
        path: filePath,
        field: key,
        code: "UNKNOWN_FIELD",
        message: `Unknown field "${key}" (type: ${typeDef.name})`,
        severity: strictMode === true ? "error" : "warning",
        type: typeDef.name,
      });
    }
  }

  return issues;
}
