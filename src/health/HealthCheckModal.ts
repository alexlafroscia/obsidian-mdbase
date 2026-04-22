// Register private types
import type {} from "obsidian-typings";

import { App, Modal, Notice, Setting } from "obsidian";
import type MdbasePlugin from "../main.ts";
import { computeSyncStatus } from "./propertySync.ts";

export class HealthCheckModal extends Modal {
  plugin: MdbasePlugin;

  constructor(app: App, plugin: MdbasePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.titleEl.setText("mdbase Health Check");
    this.modalEl.addClass("mdbase-health-modal");
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.renderPropertySync(contentEl);
  }

  private renderPropertySync(el: HTMLElement): void {
    const section = el.createDiv({ cls: "mdbase-health-section" });

    const header = section.createDiv({ cls: "mdbase-health-section-header" });
    header.createEl("h4", { text: "Property Type Sync" });
    header.createEl("p", {
      text: "Verifies that Obsidian's property type registry matches the widget types required by your mdbase type definitions.",
    });

    const mtm = this.app.metadataTypeManager;
    if (!mtm) {
      renderCallout(section, "error", "MetadataTypeManager not available.");
      return;
    }

    if (!this.plugin.types.size) {
      renderCallout(section, "neutral", "No types defined in the collection.");
      return;
    }

    const status = computeSyncStatus(this.plugin.types, () =>
      mtm.getAllProperties(),
    );

    const hasIssues =
      status.needsSync.length > 0 || status.conflicts.length > 0;

    // Conflicts — block sync
    for (const conflict of status.conflicts) {
      const parts = [...conflict.conflictingWidgets.entries()]
        .map(([widget, typeNames]) => `"${widget}" (${typeNames.join(", ")})`)
        .join(" vs ");
      const box = renderCallout(
        section,
        "error",
        `Conflict on field "${conflict.fieldName}"`,
      );
      box.createEl("p", {
        cls: "mdbase-health-callout-body",
        text: `This field requires ${parts}. Resolve the conflict in your type definitions before syncing.`,
      });
    }

    // Fields that need syncing
    if (status.needsSync.length > 0) {
      const label = `${status.needsSync.length} field${status.needsSync.length !== 1 ? "s" : ""} need${status.needsSync.length === 1 ? "s" : ""} to be registered in Obsidian`;
      const box = renderCallout(section, "warning", label);

      const list = box.createEl("ul", { cls: "mdbase-health-field-list" });
      for (const entry of status.needsSync) {
        const li = list.createEl("li", { cls: "mdbase-health-field-row" });
        li.createEl("code", { text: entry.fieldName });
        li.createSpan({ text: " → " });
        li.createEl("code", { text: entry.requiredWidget });
        li.createSpan({
          cls: "mdbase-health-field-meta",
          text: ` (${entry.definedInTypes.join(", ")})`,
        });
      }

      if (status.conflicts.length === 0) {
        new Setting(box)
          .setClass("mdbase-health-sync-setting")
          .addButton((btn) =>
            btn
              .setButtonText("Sync Now")
              .setCta()
              .onClick(async () => {
                for (const entry of status.needsSync) {
                  await mtm.setType(entry.fieldName, entry.requiredWidget);
                }
                new Notice(
                  `Synced ${status.needsSync.length} property type${status.needsSync.length !== 1 ? "s" : ""}.`,
                );
                this.render();
              }),
          );
      }
    }

    // Already up to date
    if (status.upToDate.length > 0) {
      if (!hasIssues) {
        const label = `All ${status.upToDate.length} managed property type${status.upToDate.length !== 1 ? "s are" : " is"} correctly configured`;
        renderCallout(section, "success", label);
      } else {
        const box = section.createDiv({ cls: "mdbase-health-up-to-date" });
        box.createEl("p", {
          text: `${status.upToDate.length} field${status.upToDate.length !== 1 ? "s are" : " is"} already up to date.`,
        });
      }
    }

    // No managed fields at all
    if (
      status.upToDate.length === 0 &&
      status.needsSync.length === 0 &&
      status.conflicts.length === 0
    ) {
      renderCallout(
        section,
        "neutral",
        "No fields require custom property widgets.",
      );
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

type CalloutVariant = "success" | "warning" | "error" | "neutral";

function renderCallout(
  parent: HTMLElement,
  variant: CalloutVariant,
  title: string,
): HTMLElement {
  const box = parent.createDiv({
    cls: `mdbase-health-callout mdbase-health-callout--${variant}`,
  });
  box.createEl("p", { cls: "mdbase-health-callout-title", text: title });
  return box;
}
