import type { Vault } from "obsidian";
import { parseYaml, stringifyYaml } from "obsidian";
import type { MdbaseConfig, TypeDefinition } from "../types.ts";
import { getTypesFolder } from "../types.ts";

function splitFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} {
  if (!content.startsWith("---")) {
    return { frontmatter: "", body: content };
  }
  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return { frontmatter: "", body: content };
  }
  return {
    frontmatter: content.slice(4, end).trim(),
    body: content.slice(end + 4).trimStart(),
  };
}

export function parseTypeFile(content: string): TypeDefinition | null {
  const { frontmatter } = splitFrontmatter(content);
  if (!frontmatter) return null;
  try {
    const parsed = parseYaml(frontmatter) as TypeDefinition;
    if (!parsed || typeof parsed !== "object" || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

function serializeTypeFile(typeDef: TypeDefinition, body = ""): string {
  const { name, ...rest } = typeDef;
  const frontmatterObj: Record<string, unknown> = { name, ...rest };
  const fm = stringifyYaml(frontmatterObj).trimEnd();
  return `---\n${fm}\n---\n${body}`;
}

export async function loadTypes(
  vault: Vault,
  config: MdbaseConfig,
): Promise<Map<string, TypeDefinition>> {
  const types = new Map<string, TypeDefinition>();
  const folder = getTypesFolder(config);
  const folderObj = vault.getFolderByPath(folder);
  if (!folderObj) return types;

  for (const child of folderObj.children) {
    if (!("extension" in child) || child.extension !== "md") continue;
    try {
      const content = await vault.read(child);
      const typeDef = parseTypeFile(content);
      if (typeDef) {
        types.set(typeDef.name.toLowerCase(), typeDef);
      }
    } catch {
      // skip unreadable files
    }
  }

  return types;
}

export async function saveType(
  vault: Vault,
  config: MdbaseConfig,
  typeDef: TypeDefinition,
  body = "",
): Promise<void> {
  const folder = getTypesFolder(config);
  const filePath = `${folder}/${typeDef.name}.md`;

  // Ensure folder exists
  if (!vault.getFolderByPath(folder)) {
    await vault.createFolder(folder);
  }

  const content = serializeTypeFile(typeDef, body);
  const existing = vault.getFileByPath(filePath);
  if (existing) {
    // Preserve existing body when updating
    const raw = await vault.read(existing);
    const { body: existingBody } = splitFrontmatter(raw);
    const updated = serializeTypeFile(typeDef, existingBody);
    await vault.modify(existing, updated);
  } else {
    await vault.create(filePath, content);
  }
}

export async function deleteType(
  vault: Vault,
  config: MdbaseConfig,
  name: string,
): Promise<void> {
  const folder = getTypesFolder(config);
  const filePath = `${folder}/${name}.md`;
  const file = vault.getFileByPath(filePath);
  if (file) {
    await vault.trash(file, true);
  }
}
