import { App, FuzzySuggestModal, TFile } from "obsidian";
import type MdbasePlugin from "../main.ts";
import { matchFileToTypes } from "../matching/matcher.ts";

class LinkFilePicker extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private files: TFile[],
    private onChoose: (file: TFile) => void,
  ) {
    super(app);
    this.setPlaceholder("Search for a file...");
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
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
    const linkType = typeDef.fields?.[propertyKey]?.target;
    if (linkType) return linkType;
  }
  return undefined;
}

function getCandidateFiles(
  plugin: MdbasePlugin,
  linkType: string | undefined,
): TFile[] {
  const files = plugin.app.vault.getMarkdownFiles();
  if (!linkType || !plugin.mdbaseConfig) return files;
  const lower = linkType.toLowerCase();
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
    validate: (value: unknown) => {
      return value == null || typeof value === "string";
    },
    render(
      el: HTMLElement,
      value: string | null,
      ctx: PropertyRenderContext,
    ): void {
      const { key, onChange } = ctx;

      const filePath: string | undefined =
        ctx.sourcePath ?? plugin.app.workspace.getActiveFile()?.path;

      el.addClass("mdbase-link-widget");

      const textEl = el.createSpan({ cls: "mdbase-link-value" });
      textEl.setText(value ?? "");

      const btn = el.createEl("button", {
        cls: "mdbase-link-pick",
        text: "Pick",
      });

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        const linkType = filePath
          ? getLinkType(plugin, filePath, key)
          : undefined;
        const candidates = getCandidateFiles(plugin, linkType);

        new LinkFilePicker(plugin.app, candidates, (file) => {
          const wikilink = `[[${file.basename}]]`;
          onChange(wikilink);
          textEl.setText(wikilink);
        }).open();
      });
    },
  };
}

export function unregisterLinkPropertyWidget(plugin: MdbasePlugin): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadataTypeManager = (plugin.app as any).metadataTypeManager;
  if (!metadataTypeManager) return;
  delete metadataTypeManager.registeredTypeWidgets["mdbase-link"];
}
