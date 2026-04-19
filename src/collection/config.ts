import type { Vault } from "obsidian";
import { parseYaml, stringifyYaml } from "obsidian";
import type { MdbaseConfig } from "../types.ts";
import { SPEC_VERSION } from "../types.ts";

export const CONFIG_FILENAME = "mdbase.yaml";

export async function loadConfig(vault: Vault): Promise<MdbaseConfig | null> {
  const file = vault.getFileByPath(CONFIG_FILENAME);
  if (!file) return null;
  try {
    const raw = await vault.read(file);
    const parsed = parseYaml(raw) as MdbaseConfig;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveConfig(
  vault: Vault,
  config: MdbaseConfig,
): Promise<void> {
  const content = stringifyYaml(config);
  const file = vault.getFileByPath(CONFIG_FILENAME);
  if (file) {
    await vault.modify(file, content);
  } else {
    await vault.create(CONFIG_FILENAME, content);
  }
}

export async function createDefaultConfig(vault: Vault): Promise<MdbaseConfig> {
  const config: MdbaseConfig = {
    spec_version: SPEC_VERSION,
  };
  await saveConfig(vault, config);
  return config;
}

export function configExists(vault: Vault): boolean {
  return vault.getFileByPath(CONFIG_FILENAME) !== null;
}
