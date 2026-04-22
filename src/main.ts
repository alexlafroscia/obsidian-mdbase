// Register private types
import type {} from "obsidian-typings";

import { mount, unmount } from "svelte";
import { App, Modal, Notice, Plugin, TFile } from "obsidian";
import type { MdbaseConfig, TypeDefinition, ValidationIssue } from "./types.ts";
import {
  CONFIG_FILENAME,
  createDefaultConfig,
  loadConfig,
} from "./collection/config.ts";
import { loadTypes } from "./collection/typeLoader.ts";
import { matchFileToTypes } from "./matching/matcher.ts";
import { validateFile } from "./validation/validator.ts";
import { MdbaseSettingTab } from "./settings/SettingsTab.ts";
import {
  registerLinkPropertyWidget,
  unregisterLinkPropertyWidget,
} from "./properties/LinkPropertyWidget.ts";
import { HealthCheckModal } from "./health/HealthCheckModal.ts";
import {
  registerValidationButton,
  refreshValidationButton,
} from "./validation/validationButton.ts";
import {
  registerStatusBar,
  refreshStatusBar,
  clearStatusBar,
} from "./validation/statusBar.ts";
import ValidationModalComponent from "./ui/ValidationModal.svelte";

export default class MdbasePlugin extends Plugin {
  mdbaseConfig: MdbaseConfig | null = null;
  types: Map<string, TypeDefinition> = new Map();

  issues: Map<string, ValidationIssue[]> = new Map();

  async onload(): Promise<void> {
    registerStatusBar(this);

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

    this.addCommand({
      id: "health-check",
      name: "Health check",
      callback: () => new HealthCheckModal(this.app, this).open(),
    });

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.validateAndDisplay(file);
        }
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file.extension === "md") {
          this.validateAndDisplay(file);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path === CONFIG_FILENAME) {
          this.reload();
        }
      }),
    );

    // Custom property editors
    registerLinkPropertyWidget(this);
    registerValidationButton(this);

    this.app.workspace.onLayoutReady(async () => {
      await this.reload();
    });
  }

  onunload(): void {
    unregisterLinkPropertyWidget(this);
  }

  async initializeCollection(): Promise<void> {
    this.mdbaseConfig = await createDefaultConfig(this.app.vault);
    this.types = new Map();
    new Notice("Collection initialized! mdbase.yaml created at vault root.");
  }

  async loadConfig(): Promise<void> {
    this.mdbaseConfig = await loadConfig(this.app.vault);
    this.types = this.mdbaseConfig
      ? await loadTypes(this.app.vault, this.mdbaseConfig)
      : new Map();
  }

  async reload(): Promise<void> {
    await this.loadConfig();

    this.issues.clear();
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.validateAndDisplay(activeFile);
    }
  }

  async validateAndDisplay(file: TFile): Promise<void> {
    if (!this.mdbaseConfig) {
      clearStatusBar();
      return;
    }
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ??
      {}) as Record<string, unknown>;
    const matched = matchFileToTypes(
      file.path,
      fm,
      this.types,
      this.mdbaseConfig,
    );
    const fileIssues = validateFile(file.path, fm, matched, this.mdbaseConfig);
    this.issues.set(file.path, fileIssues);
    refreshStatusBar(file, fileIssues, matched.length > 0);
    refreshValidationButton(this);
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
    if (!this.mdbaseConfig) {
      new Notice("No mdbase collection found.");
      return;
    }
    const files = this.app.vault.getMarkdownFiles();
    let totalErrors = 0;
    let totalWarnings = 0;
    this.issues.clear();

    for (const file of files) {
      const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ??
        {}) as Record<string, unknown>;
      const matched = matchFileToTypes(
        file.path,
        fm,
        this.types,
        this.mdbaseConfig,
      );
      const fileIssues = validateFile(
        file.path,
        fm,
        matched,
        this.mdbaseConfig,
      );
      this.issues.set(file.path, fileIssues);
      totalErrors += fileIssues.filter((i) => i.severity === "error").length;
      totalWarnings += fileIssues.filter(
        (i) => i.severity === "warning",
      ).length;
    }

    new Notice(
      `Validation complete: ${totalErrors} error${totalErrors !== 1 ? "s" : ""}, ${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""} across ${files.length} files.`,
    );
  }
}

class ValidationModal extends Modal {
  file: TFile;
  fileIssues: ValidationIssue[];
  private component: ReturnType<typeof mount> | null = null;

  constructor(app: App, file: TFile, issues: ValidationIssue[]) {
    super(app);
    this.file = file;
    this.fileIssues = issues;
  }

  onOpen(): void {
    this.titleEl.setText(`Validation: ${this.file.name}`);
    this.component = mount(ValidationModalComponent, {
      target: this.contentEl,
      props: { issues: this.fileIssues },
    });
  }

  onClose(): void {
    if (this.component) unmount(this.component);
    this.contentEl.empty();
  }
}
