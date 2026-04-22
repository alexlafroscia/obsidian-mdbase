import type { FieldType, TypeDefinition } from "../types.ts";

// Only link fields use a custom widget provided by this plugin.
export function getRequiredWidgetType(fieldType: FieldType): string | null {
  if (fieldType === "link") return "mdbase-link";
  return null;
}

export interface FieldWidgetEntry {
  fieldName: string;
  requiredWidget: string;
  definedInTypes: string[];
}

export interface ConflictEntry {
  fieldName: string;
  // widget type → type names that require it
  conflictingWidgets: Map<string, string[]>;
}

export interface PropertySyncStatus {
  upToDate: FieldWidgetEntry[];
  needsSync: FieldWidgetEntry[];
  conflicts: ConflictEntry[];
}

export function computeSyncStatus(
  types: Map<string, TypeDefinition>,
  getAllProperties: () => Record<string, { widget: string }>,
): PropertySyncStatus {
  // fieldName → Map<requiredWidget, typeNames[]>
  const fieldWidgetMap = new Map<string, Map<string, string[]>>();

  for (const typeDef of types.values()) {
    for (const [fieldName, fieldDef] of Object.entries(typeDef.fields ?? {})) {
      const requiredWidget = getRequiredWidgetType(fieldDef.type);
      if (!requiredWidget) continue;

      if (!fieldWidgetMap.has(fieldName)) {
        fieldWidgetMap.set(fieldName, new Map());
      }
      const widgetMap = fieldWidgetMap.get(fieldName)!;
      if (!widgetMap.has(requiredWidget)) {
        widgetMap.set(requiredWidget, []);
      }
      widgetMap.get(requiredWidget)!.push(typeDef.name);
    }
  }

  const currentProperties = getAllProperties();
  const upToDate: FieldWidgetEntry[] = [];
  const needsSync: FieldWidgetEntry[] = [];
  const conflicts: ConflictEntry[] = [];

  for (const [fieldName, widgetMap] of fieldWidgetMap.entries()) {
    if (widgetMap.size > 1) {
      conflicts.push({ fieldName, conflictingWidgets: widgetMap });
      continue;
    }

    const [[requiredWidget, typeNames]] = [...widgetMap.entries()];
    const entry: FieldWidgetEntry = {
      fieldName,
      requiredWidget,
      definedInTypes: typeNames,
    };

    if (currentProperties[fieldName]?.widget === requiredWidget) {
      upToDate.push(entry);
    } else {
      needsSync.push(entry);
    }
  }

  return { upToDate, needsSync, conflicts };
}
