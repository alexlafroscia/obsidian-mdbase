import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import type MdbasePlugin from "../main.ts";
import ValidationViewComponent from "./ValidationView.svelte";

export const VALIDATION_VIEW_TYPE = "mdbase-validation-view";

export class ValidationView extends ItemView {
  private plugin: MdbasePlugin;
  private component: ReturnType<typeof mount> | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: MdbasePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VALIDATION_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Validation Issues";
  }

  getIcon(): string {
    return "shield-alert";
  }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.mountComponent()),
    );
    this.mountComponent();
  }

  async onClose(): Promise<void> {
    if (this.component) {
      unmount(this.component);
      this.component = null;
    }
  }

  refresh(): void {
    this.mountComponent();
  }

  private mountComponent(): void {
    if (this.component) {
      unmount(this.component);
      this.component = null;
    }
    this.contentEl.empty();

    const isSidebar = this.leaf.getRoot() !== this.app.workspace.rootSplit;

    this.component = mount(ValidationViewComponent, {
      target: this.contentEl,
      props: {
        issuesByFile: this.plugin.issues,
        isSidebar,
        openFile: (path: string) => {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (file instanceof TFile) {
            void this.app.workspace.openLinkText(path, "");
          }
        },
      },
    });
  }
}
