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

function parseLinkText(raw: string): { path: string; display: string } {
  const m = raw.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
  if (m) return { path: m[1], display: m[2] ?? m[1] };
  return { path: raw, display: raw };
}

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
  const metadataTypeManager = plugin.app.metadataTypeManager;
  if (!metadataTypeManager) return;

  metadataTypeManager.registeredTypeWidgets["mdbase-link"] = {
    type: "mdbase-link",
    icon: "link",
    name: () => "Link (mdbase)",
    validate: (value: unknown) => value == null || typeof value === "string",
    render(el: HTMLElement, initialValue: string | null, ctx) {
      const { key, onChange } = ctx;

      const filePath: string | undefined =
        ctx.sourcePath ?? plugin.app.workspace.getActiveFile()?.path;

      let currentValue = initialValue;

      const linkEl = el.createEl("a", {
        cls: "internal-link mdbase-link-display",
      });
      const input = el.createEl("input", {
        type: "text",
        placeholder: "Empty",
        cls: "mdbase-link-input",
      });

      const showView = () => {
        if (currentValue) {
          const { path, display } = parseLinkText(currentValue);
          linkEl.setText(display);
          linkEl.dataset.href = path;
          linkEl.style.display = "";
        } else {
          linkEl.style.display = "none";
        }
        input.style.display = "none";
      };

      const showEdit = () => {
        linkEl.style.display = "none";
        input.style.display = "";
        input.value = currentValue ?? "";
        input.focus();
      };

      linkEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentValue) {
          const { path } = parseLinkText(currentValue);
          plugin.app.workspace.openLinkText(path, filePath ?? "", false);
        }
      });

      el.addEventListener("click", () => showEdit());

      input.addEventListener("blur", () => {
        // Defer so suggestion selectSuggestion fires before we hide the input
        setTimeout(showView, 100);
      });

      input.addEventListener("change", () => {
        currentValue = input.value || null;
        onChange(currentValue);
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
          currentValue = wikilink;
          input.value = wikilink;
          onChange(wikilink);
          showView();
        },
      );

      // Initial state
      if (currentValue) {
        showView();
      } else {
        input.style.display = "";
        linkEl.style.display = "none";
      }

      return {
        type: "mdbase-link",
        focus() {
          showEdit();
        },
      };
    },
  };
}

export function unregisterLinkPropertyWidget(plugin: MdbasePlugin): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadataTypeManager = (plugin.app as any).metadataTypeManager;
  if (!metadataTypeManager) return;
  delete metadataTypeManager.registeredTypeWidgets["mdbase-link"];
}
