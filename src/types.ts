export type ValidationMode = "off" | "warn" | "error";
export type StrictMode = false | "warn" | true;

export interface MdbaseConfig {
  spec_version: "0.2.1";
  name?: string;
  description?: string;
  settings?: {
    types_folder?: string;
    explicit_type_keys?: string[];
    default_validation?: ValidationMode;
    default_strict?: StrictMode;
    extensions?: string[];
    exclude?: string[];
    include_subfolders?: boolean;
    id_field?: string;
    timezone?: string;
    write_nulls?: "omit" | "explicit";
    write_defaults?: boolean;
    write_empty_lists?: boolean;
    rename_update_refs?: boolean;
    cache_folder?: string;
  };
}

export type FieldType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "enum"
  | "list"
  | "object"
  | "link"
  | "tags"
  | "any";

export interface FieldDef {
  type: FieldType;
  required?: boolean;
  default?: unknown;
  description?: string;
  deprecated?: boolean;
  unique?: boolean;
  // string
  min_length?: number;
  max_length?: number;
  pattern?: string;
  // integer / number
  min?: number;
  max?: number;
  // enum
  values?: string[];
  // list
  element_type?: FieldType;
  unique_elements?: boolean;
  min_items?: number;
  max_items?: number;
  // object
  fields?: Record<string, FieldDef>;
  // link
  target?: string;
}

export interface MatchRule {
  path_glob?: string;
  fields_present?: string[];
}

export interface TypeDefinition {
  name: string;
  description?: string;
  extends?: string;
  strict?: StrictMode;
  path_pattern?: string;
  match?: MatchRule;
  display_name_key?: string;
  fields?: Record<string, FieldDef>;
}

export interface ValidationIssue {
  path: string;
  field: string;
  code: string;
  message: string;
  severity: "error" | "warning";
  expected?: string;
  actual?: string;
  type?: string;
}

export const DEFAULT_TYPES_FOLDER = "_types";
export const DEFAULT_EXPLICIT_TYPE_KEYS = ["type", "types"];
export const DEFAULT_VALIDATION: ValidationMode = "warn";
export const DEFAULT_STRICT: StrictMode = false;
export const SPEC_VERSION = "0.2.1" as const;

export function getTypesFolder(config: MdbaseConfig): string {
  return config.settings?.types_folder ?? DEFAULT_TYPES_FOLDER;
}

export function getExplicitTypeKeys(config: MdbaseConfig): string[] {
  return config.settings?.explicit_type_keys ?? DEFAULT_EXPLICIT_TYPE_KEYS;
}

export function getDefaultValidation(config: MdbaseConfig): ValidationMode {
  return config.settings?.default_validation ?? DEFAULT_VALIDATION;
}

export function getDefaultStrict(config: MdbaseConfig): StrictMode {
  return config.settings?.default_strict ?? DEFAULT_STRICT;
}
