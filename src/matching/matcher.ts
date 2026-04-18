import micromatch from "micromatch";
import type { MdbaseConfig, TypeDefinition } from "../types.ts";
import { getExplicitTypeKeys } from "../types.ts";

function resolveInheritance(
  name: string,
  types: Map<string, TypeDefinition>,
  visited = new Set<string>()
): TypeDefinition | null {
  if (visited.has(name)) return null; // circular
  visited.add(name);
  const def = types.get(name.toLowerCase());
  if (!def) return null;
  if (!def.extends) return def;

  const parent = resolveInheritance(def.extends.toLowerCase(), types, visited);
  if (!parent) return def;

  return {
    ...parent,
    ...def,
    fields: { ...(parent.fields ?? {}), ...(def.fields ?? {}) },
  };
}

export function resolveType(
  name: string,
  types: Map<string, TypeDefinition>
): TypeDefinition | null {
  return resolveInheritance(name.toLowerCase(), types);
}

export function matchFileToTypes(
  filePath: string,
  frontmatter: Record<string, unknown>,
  types: Map<string, TypeDefinition>,
  config: MdbaseConfig
): TypeDefinition[] {
  const explicitKeys = getExplicitTypeKeys(config);

  // Level 1: explicit declaration
  for (const key of explicitKeys) {
    const val = frontmatter[key];
    if (val !== undefined && val !== null) {
      const names: string[] = Array.isArray(val) ? val.map(String) : [String(val)];
      const resolved: TypeDefinition[] = [];
      for (const name of names) {
        const def = resolveType(name, types);
        if (def) resolved.push(def);
      }
      if (resolved.length > 0) return resolved;
    }
  }

  // Level 2: match rules (path_glob and fields_present)
  const matched: TypeDefinition[] = [];
  for (const typeDef of types.values()) {
    if (!typeDef.match) continue;
    if (matchesRules(filePath, frontmatter, typeDef)) {
      const resolved = resolveType(typeDef.name, types);
      if (resolved) matched.push(resolved);
    }
  }

  return matched;
}

function matchesRules(
  filePath: string,
  frontmatter: Record<string, unknown>,
  typeDef: TypeDefinition
): boolean {
  const { match } = typeDef;
  if (!match) return false;

  if (match.path_glob) {
    if (!micromatch.isMatch(filePath, match.path_glob, { dot: true })) {
      return false;
    }
  }

  if (match.fields_present && match.fields_present.length > 0) {
    for (const field of match.fields_present) {
      const val = frontmatter[field];
      if (val === undefined || val === null) return false;
    }
  }

  return true;
}
