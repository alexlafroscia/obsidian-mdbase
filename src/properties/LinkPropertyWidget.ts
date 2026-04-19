import { AbstractInputSuggest, App, TFile } from "obsidian";
import type MdbasePlugin from "../main.ts";
import { matchFileToTypes } from "../matching/matcher.ts";

class LinkSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private getCandidates: () => TFile[],
    private onChoose: (file: TFile) => void,
  ) {
    super(app, inputEl);
  }

  getSuggestions(query: string): TFile[] {
    const lower = query.toLowerCase().replace(/^\[\[/, "");
    return this.getCandidates().filter(
      (f) =>
        f.basename.toLowerCase().includes(lower) ||
        f.path.toLowerCase().includes(lower),
    );
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createDiv({ text: file.basename });
    el.createDiv({ cls: "mdbase-link-suggest-path", text: file.path });
  }

  selectSuggestion(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
    this.onChoose(file);
    this.close();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PropertyRenderContext = any;

function getLinkType(
  plugin: MdbasePlugin,
  filePath: string,
  propertyKey: string,
): string | undefined {
  if (!plugin.mdbaseConfig) return undefined;
  const file = plugin.app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) return undefined;
  const fm = (plugin.app.metadataCache.getFileCache(file)?.frontmatter ??
    {}) as Record<string, unknown>;
  const matchedTypes = matchFileToTypes(
    file.path,
    fm,
    plugin.types,
    plugin.mdbaseConfig,
  );
  for (const typeDef of matchedTypes) {
    const target = typeDef.fields?.[propertyKey]?.target;
    if (target) return target;
  }
  return undefined;
}

function getCandidateFiles(
  plugin: MdbasePlugin,
  target: string | undefined,
): TFile[] {
  const files = plugin.app.vault.getMarkdownFiles();
  if (!target || !plugin.mdbaseConfig) return files;
  const lower = target.toLowerCase();
  return files.filter((f) => {
    const fm = (plugin.app.metadataCache.getFileCache(f)?.frontmatter ??
      {}) as Record<string, unknown>;
    const matched = matchFileToTypes(
      f.path,
      fm,
      plugin.types,
      plugin.mdbaseConfig!,
    );
    return matched.some((t) => t.name.toLowerCase() === lower);
  });
}

export function registerLinkPropertyWidget(plugin: MdbasePlugin): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadataTypeManager = (plugin.app as any).metadataTypeManager;
  if (!metadataTypeManager) return;

  metadataTypeManager.registeredTypeWidgets["mdbase-link"] = {
    type: "mdbase-link",
    icon: "link",
    name: () => "Link (mdbase)",
    validate: (value: unknown) => value == null || typeof value === "string",
    render(
      el: HTMLElement,
      value: string | null,
      ctx: PropertyRenderContext,
    ): void {
      const { key, onChange } = ctx;

      const filePath: string | undefined =
        ctx.sourcePath ?? plugin.app.workspace.getActiveFile()?.path;

      const input = el.createEl("input", {
        type: "text",
        placeholder: "Empty",
        cls: "mdbase-link-input",
      });
      input.value = value ?? "";

      input.addEventListener("change", () => {
        onChange(input.value || null);
      });

      new LinkSuggest(
        plugin.app,
        input,
        () => {
          const target = filePath
            ? getLinkType(plugin, filePath, key)
            : undefined;
          return getCandidateFiles(plugin, target);
        },
        (file) => {
          const wikilink = `[[${file.basename}]]`;
          input.value = wikilink;
          onChange(wikilink);
        },
      );
    },
  };
}

export function unregisterLinkPropertyWidget(plugin: MdbasePlugin): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadataTypeManager = (plugin.app as any).metadataTypeManager;
  if (!metadataTypeManager) return;
  delete metadataTypeManager.registeredTypeWidgets["mdbase-link"];
}
