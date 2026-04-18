import { App, Modal, Notice, Plugin, TFile } from "obsidian";
import type { MdbaseConfig, TypeDefinition, ValidationIssue } from "./types.ts";
import { CONFIG_FILENAME, createDefaultConfig, loadConfig } from "./collection/config.ts";
import { loadTypes } from "./collection/typeLoader.ts";
import { matchFileToTypes } from "./matching/matcher.ts";
import { validateFile } from "./validation/validator.ts";
import { MdbaseSettingTab } from "./settings/SettingsTab.ts";

export default class MdbasePlugin extends Plugin {
  config: MdbaseConfig | null = null;
  types: Map<string, TypeDefinition> = new Map();
  issues: Map<string, ValidationIssue[]> = new Map();
  private statusBarItem!: HTMLElement;

  async onload(): Promise<void> {
    this.config = await loadConfig(this.app.vault);
    if (this.config) {
      this.types = await loadTypes(this.app.vault, this.config);
    }

    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText("mdbase");

    this.addSettingTab(new MdbaseSettingTab(this.app, this));

    this.addCommand({
      id: "validate-current-file",
      name: "Validate current file",
      callback: () => this.validateCurrentFile(),
    });

    this.addCommand({
      id: "validate-all-files",
      name: "Validate all files",
      callback: () => this.validateAllFiles(),
    });

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.validateAndDisplay(file);
        }
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file.extension === "md") {
          this.validateAndDisplay(file);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path === CONFIG_FILENAME) {
          this.reload();
        }
      })
    );
  }

  async initializeCollection(): Promise<void> {
    this.config = await createDefaultConfig(this.app.vault);
    this.types = new Map();
    new Notice("Collection initialized! mdbase.yaml created at vault root.");
  }

  async reload(): Promise<void> {
    this.config = await loadConfig(this.app.vault);
    this.types = this.config ? await loadTypes(this.app.vault, this.config) : new Map();
    this.issues.clear();
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.validateAndDisplay(activeFile);
    }
  }

  async validateAndDisplay(file: TFile): Promise<void> {
    if (!this.config) {
      this.statusBarItem.setText("mdbase: no collection");
      return;
    }
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
    const matched = matchFileToTypes(file.path, fm, this.types, this.config);
    const fileIssues = validateFile(file.path, fm, matched, this.config);
    this.issues.set(file.path, fileIssues);
    this.updateStatusBar(file, fileIssues, matched.length > 0);
  }

  private updateStatusBar(
    file: TFile,
    fileIssues: ValidationIssue[],
    hasType: boolean
  ): void {
    if (!hasType) {
      this.statusBarItem.setText("mdbase: untyped");
      this.statusBarItem.className = "";
      return;
    }
    const errors = fileIssues.filter((i) => i.severity === "error").length;
    const warnings = fileIssues.filter((i) => i.severity === "warning").length;
    if (errors > 0) {
      this.statusBarItem.setText(`mdbase: ${errors} error${errors > 1 ? "s" : ""}`);
      this.statusBarItem.addClass("mdbase-status-error");
      this.statusBarItem.removeClass("mdbase-status-warning");
      this.statusBarItem.removeClass("mdbase-status-ok");
    } else if (warnings > 0) {
      this.statusBarItem.setText(`mdbase: ${warnings} warning${warnings > 1 ? "s" : ""}`);
      this.statusBarItem.addClass("mdbase-status-warning");
      this.statusBarItem.removeClass("mdbase-status-error");
      this.statusBarItem.removeClass("mdbase-status-ok");
    } else {
      this.statusBarItem.setText("mdbase: ✓");
      this.statusBarItem.addClass("mdbase-status-ok");
      this.statusBarItem.removeClass("mdbase-status-error");
      this.statusBarItem.removeClass("mdbase-status-warning");
    }
  }

  private validateCurrentFile(): void {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("No active file.");
      return;
    }
    const fileIssues = this.issues.get(file.path) ?? [];
    const modal = new ValidationModal(this.app, file, fileIssues);
    modal.open();
  }

  private async validateAllFiles(): Promise<void> {
    if (!this.config) {
      new Notice("No mdbase collection found.");
      return;
    }
    const files = this.app.vault.getMarkdownFiles();
    let totalErrors = 0;
    let totalWarnings = 0;
    this.issues.clear();

    for (const file of files) {
      const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
      const matched = matchFileToTypes(file.path, fm, this.types, this.config);
      const fileIssues = validateFile(file.path, fm, matched, this.config);
      this.issues.set(file.path, fileIssues);
      totalErrors += fileIssues.filter((i) => i.severity === "error").length;
      totalWarnings += fileIssues.filter((i) => i.severity === "warning").length;
    }

    new Notice(
      `Validation complete: ${totalErrors} error${totalErrors !== 1 ? "s" : ""}, ${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""} across ${files.length} files.`
    );
  }
}

class ValidationModal extends Modal {
  file: TFile;
  fileIssues: ValidationIssue[];

  constructor(app: App, file: TFile, issues: ValidationIssue[]) {
    super(app);
    this.file = file;
    this.fileIssues = issues;
  }

  onOpen(): void {
    this.titleEl.setText(`Validation: ${this.file.name}`);
    const { contentEl } = this;
    contentEl.addClass("mdbase-validation-modal");

    if (this.fileIssues.length === 0) {
      contentEl.createEl("p", { text: "No issues found. ✓", cls: "mdbase-status-ok" });
      return;
    }

    const list = contentEl.createDiv({ cls: "mdbase-issue-list" });
    for (const issue of this.fileIssues) {
      const item = list.createDiv({ cls: `mdbase-issue-item ${issue.severity}` });
      item.createDiv({ cls: "mdbase-issue-field", text: issue.field });
      item.createDiv({ cls: "mdbase-issue-message", text: issue.message });
      const meta: string[] = [];
      if (issue.type) meta.push(`type: ${issue.type}`);
      if (issue.code) meta.push(issue.code);
      if (meta.length) item.createDiv({ cls: "mdbase-issue-type", text: meta.join(" · ") });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
