import { MarkdownView, TFile } from "obsidian";
import type { ComponentProps } from "svelte";
import { SvelteComponentChild } from "obsidian-svelte-ui";

import type MdbasePlugin from "../main.ts";

import FileValidationButton from "./FileValidationButton.svelte";

type ChildView = SvelteComponentChild<
  ComponentProps<typeof FileValidationButton>
>;

function createChildView(
  plugin: MdbasePlugin,
  view: MarkdownView,
  file: TFile,
): ChildView | undefined {
  const addBtn = view.containerEl.querySelector(".metadata-add-button");
  if (!addBtn) return;

  const svelteRoot = createEl("div", {
    attr: {
      // Remove DOM node from layout
      style: "display: contents;",
    },
  });
  addBtn.insertAdjacentElement("afterend", svelteRoot);

  return new SvelteComponentChild(FileValidationButton, {
    target: svelteRoot,
    props: {
      plugin,
      file,
    },
  });
}

const SVELTE_ROOT_INSTANCES = new WeakMap<MarkdownView, ChildView>();

function refresh(plugin: MdbasePlugin) {
  // If the types aren't loaded yet, don't do anything
  if (!plugin.mdbaseConfig) return;

  // Get the view + file for the active tab
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) return;

  const file = view.file;
  if (!file) return;

  // If we already have an instance for this view, just update it with the
  // active file
  const existingInstance = SVELTE_ROOT_INSTANCES.get(view);
  if (existingInstance) {
    // `.setProps` is necessary to force Svelte to update computed properties
    existingInstance.setProps({ plugin, file });
    return;
  }

  // Otherwise, create it
  const addBtn = view.containerEl.querySelector(".metadata-add-button");
  if (!addBtn) return;

  const newInstance = createChildView(plugin, view, file);
  if (newInstance) {
    view.addChild(newInstance);

    SVELTE_ROOT_INSTANCES.set(view, newInstance);
  }
}

export function registerValidationButton(plugin: MdbasePlugin) {
  plugin.registerEvent(
    plugin.app.workspace.on("layout-change", () => refresh(plugin)),
  );
  plugin.registerEvent(
    plugin.app.workspace.on("active-leaf-change", () => refresh(plugin)),
  );
  plugin.registerEvent(
    plugin.app.workspace.on("file-open", () => refresh(plugin)),
  );
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", () => refresh(plugin)),
  );
}

export function refreshValidationButton(plugin: MdbasePlugin) {
  refresh(plugin);
}
