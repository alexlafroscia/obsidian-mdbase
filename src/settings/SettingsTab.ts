import {
  App,
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
  setIcon,
} from "obsidian";
import type MdbasePlugin from "../main.ts";
import type {
  FieldDef,
  FieldType,
  MdbaseConfig,
  TypeDefinition,
} from "../types.ts";
import { FIELD_TYPES } from "../schema/fieldTypes.ts";
import { saveConfig } from "../collection/config.ts";
import { deleteType, saveType } from "../collection/typeLoader.ts";

export class MdbaseSettingTab extends PluginSettingTab {
  plugin: MdbasePlugin;

  constructor(app: App, plugin: MdbasePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    if (!this.plugin.mdbaseConfig) {
      this.renderNoCollection(containerEl);
    } else {
      this.renderCollectionSettings(containerEl, this.plugin.mdbaseConfig);
      this.renderTypesSection(containerEl);
    }
  }

  private renderNoCollection(el: HTMLElement): void {
    const section = el.createDiv({ cls: "mdbase-settings-section" });
    section.createEl("h3", { text: "mdbase Collection" });

    const empty = section.createDiv({ cls: "mdbase-empty-state" });
    empty.createEl("p", {
      text: "No mdbase.yaml found at the vault root. Initialize a collection to get started.",
    });

    new Setting(section)
      .setName("Initialize collection")
      .setDesc("Creates mdbase.yaml at the vault root with default settings.")
      .addButton((btn) =>
        btn
          .setButtonText("Initialize")
          .setCta()
          .onClick(async () => {
            await this.plugin.initializeCollection();
            this.display();
          }),
      );
  }

  private renderCollectionSettings(
    el: HTMLElement,
    config: MdbaseConfig,
  ): void {
    const section = el.createDiv({ cls: "mdbase-settings-section" });
    section.createEl("h3", { text: "Collection Settings" });

    new Setting(section)
      .setName("Name")
      .setDesc("Human-readable collection title (optional).")
      .addText((text) =>
        text.setValue(config.name ?? "").onChange(async (value) => {
          config.name = value || undefined;
          await saveConfig(this.app.vault, config);
        }),
      );

    new Setting(section)
      .setName("Description")
      .setDesc("Short description of this collection (optional).")
      .addText((text) =>
        text.setValue(config.description ?? "").onChange(async (value) => {
          config.description = value || undefined;
          await saveConfig(this.app.vault, config);
        }),
      );

    new Setting(section)
      .setName("Default validation")
      .setDesc("How validation issues are handled globally.")
      .addDropdown((drop) =>
        drop
          .addOption("off", "Off")
          .addOption("warn", "Warn")
          .addOption("error", "Error")
          .setValue(config.settings?.default_validation ?? "warn")
          .onChange(async (value) => {
            config.settings ??= {};
            config.settings.default_validation = value as
              | "off"
              | "warn"
              | "error";
            await saveConfig(this.app.vault, config);
          }),
      );

    new Setting(section)
      .setName("Default strict mode")
      .setDesc("How unknown frontmatter fields are handled.")
      .addDropdown((drop) =>
        drop
          .addOption("false", "Allow (no warning)")
          .addOption("warn", "Warn")
          .addOption("true", "Error")
          .setValue(String(config.settings?.default_strict ?? false))
          .onChange(async (value) => {
            config.settings ??= {};
            config.settings.default_strict =
              value === "true" ? true : value === "warn" ? "warn" : false;
            await saveConfig(this.app.vault, config);
          }),
      );

    new Setting(section)
      .setName("Types folder")
      .setDesc("Folder containing type definitions (default: _types).")
      .addText((text) =>
        text
          .setPlaceholder("_types")
          .setValue(config.settings?.types_folder ?? "")
          .onChange(async (value) => {
            config.settings ??= {};
            config.settings.types_folder = value || undefined;
            await saveConfig(this.app.vault, config);
            await this.plugin.reload();
          }),
      );
  }

  private renderTypesSection(el: HTMLElement): void {
    const section = el.createDiv({ cls: "mdbase-settings-section" });
    section.createEl("h3", { text: "Types" });

    const typeList = section.createDiv({ cls: "mdbase-type-list" });
    this.renderTypeList(typeList);

    new Setting(section).addButton((btn) =>
      btn
        .setButtonText("Add Type")
        .setCta()
        .onClick(() => {
          const modal = new TypeEditorModal(this.app, this.plugin, null, () => {
            this.display();
          });
          modal.open();
        }),
    );
  }

  private renderTypeList(el: HTMLElement): void {
    el.empty();
    if (this.plugin.types.size === 0) {
      el.createDiv({
        cls: "mdbase-empty-state",
        text: 'No types defined yet. Click "Add Type" to create one.',
      });
      return;
    }

    for (const typeDef of this.plugin.types.values()) {
      this.renderTypeItem(el, typeDef);
    }
  }

  private renderTypeItem(el: HTMLElement, typeDef: TypeDefinition): void {
    const item = el.createDiv({ cls: "mdbase-type-item" });
    const header = item.createDiv({ cls: "mdbase-type-item-header" });

    const info = header.createDiv();
    info.createDiv({ cls: "mdbase-type-item-title", text: typeDef.name });

    const meta: string[] = [];
    const fieldCount = Object.keys(typeDef.fields ?? {}).length;
    meta.push(`${fieldCount} field${fieldCount !== 1 ? "s" : ""}`);
    if (typeDef.extends) meta.push(`extends: ${typeDef.extends}`);
    if (typeDef.match?.path_glob) meta.push(`glob: ${typeDef.match.path_glob}`);
    if (typeDef.match?.fields_present?.length) {
      meta.push(`fields_present: ${typeDef.match.fields_present.join(", ")}`);
    }
    if (typeDef.description) {
      info.createDiv({
        cls: "mdbase-type-item-meta",
        text: typeDef.description,
      });
    }
    info.createDiv({ cls: "mdbase-type-item-meta", text: meta.join(" · ") });

    const actions = header.createDiv({ cls: "mdbase-type-item-actions" });

    const editBtn = actions.createEl("button", { text: "Edit" });
    editBtn.addEventListener("click", () => {
      const modal = new TypeEditorModal(this.app, this.plugin, typeDef, () => {
        this.display();
      });
      modal.open();
    });

    const deleteBtn = actions.createEl("button", { text: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      if (!this.plugin.mdbaseConfig) return;
      await deleteType(this.app.vault, this.plugin.mdbaseConfig, typeDef.name);
      await this.plugin.reload();
      this.display();
      new Notice(`Deleted type "${typeDef.name}"`);
    });
  }
}

class TypeEditorModal extends Modal {
  plugin: MdbasePlugin;
  original: TypeDefinition | null;
  onSave: () => void;
  draft: TypeDefinition;
  fieldEditorEl: HTMLElement | null = null;
  editingFieldName: string | null = null;

  constructor(
    app: App,
    plugin: MdbasePlugin,
    original: TypeDefinition | null,
    onSave: () => void,
  ) {
    super(app);
    this.plugin = plugin;
    this.original = original;
    this.onSave = onSave;
    this.draft = original
      ? structuredClone(original)
      : { name: "", fields: {} };
  }

  onOpen(): void {
    this.titleEl.setText(
      this.original ? `Edit type: ${this.original.name}` : "Add type",
    );
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.fieldEditorEl = null;
    this.editingFieldName = null;

    // --- Basic info ---
    new Setting(contentEl)
      .setName("Name")
      .setDesc("Lowercase alphanumeric, hyphens, underscores only.")
      .addText((t) =>
        t
          .setValue(this.draft.name)
          .setPlaceholder("note")
          .onChange((v) => {
            this.draft.name = v.toLowerCase();
          }),
      );

    new Setting(contentEl).setName("Description").addText((t) =>
      t.setValue(this.draft.description ?? "").onChange((v) => {
        this.draft.description = v || undefined;
      }),
    );

    new Setting(contentEl)
      .setName("Extends")
      .setDesc("Parent type to inherit fields from.")
      .addText((t) =>
        t
          .setValue(this.draft.extends ?? "")
          .setPlaceholder("base-type")
          .onChange((v) => {
            this.draft.extends = v || undefined;
          }),
      );

    new Setting(contentEl)
      .setName("Strict mode")
      .setDesc("How unknown fields are handled for this type.")
      .addDropdown((d) =>
        d
          .addOption("inherit", "Inherit from collection")
          .addOption("false", "Allow")
          .addOption("warn", "Warn")
          .addOption("true", "Error")
          .setValue(
            this.draft.strict === undefined
              ? "inherit"
              : String(this.draft.strict),
          )
          .onChange((v) => {
            this.draft.strict =
              v === "inherit"
                ? undefined
                : v === "true"
                  ? true
                  : v === "warn"
                    ? "warn"
                    : false;
          }),
      );

    // --- Match rules ---
    contentEl.createEl("h4", { text: "Match Rules" });

    new Setting(contentEl)
      .setName("Path glob")
      .setDesc('Auto-match files by path (e.g. "notes/*.md").')
      .addText((t) =>
        t
          .setValue(this.draft.match?.path_glob ?? "")
          .setPlaceholder("notes/*.md")
          .onChange((v) => {
            this.draft.match ??= {};
            this.draft.match.path_glob = v || undefined;
            if (
              !this.draft.match.path_glob &&
              !this.draft.match.fields_present?.length
            ) {
              this.draft.match = undefined;
            }
          }),
      );

    new Setting(contentEl)
      .setName("Fields present")
      .setDesc("Auto-match if these fields exist (comma-separated).")
      .addText((t) =>
        t
          .setValue((this.draft.match?.fields_present ?? []).join(", "))
          .setPlaceholder("due_date, status")
          .onChange((v) => {
            const fields = v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            this.draft.match ??= {};
            this.draft.match.fields_present = fields.length
              ? fields
              : undefined;
            if (
              !this.draft.match.path_glob &&
              !this.draft.match.fields_present?.length
            ) {
              this.draft.match = undefined;
            }
          }),
      );

    // --- Fields ---
    contentEl.createEl("h4", { text: "Fields" });
    const fieldList = contentEl.createDiv({ cls: "mdbase-field-list" });
    this.renderFieldList(fieldList);

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Add Field").onClick(() => {
        this.draft.fields ??= {};
        const modal = new FieldEditorModal(
          this.app,
          null,
          null,
          (name, def) => {
            this.draft.fields![name] = def;
            this.render();
          },
        );
        modal.open();
      }),
    );

    // --- Save / Cancel ---
    const actions = contentEl.createDiv({ cls: "mdbase-actions-row" });
    const cancelBtn = actions.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = actions.createEl("button", {
      text: "Save",
      cls: "mod-cta",
    });
    saveBtn.addEventListener("click", async () => {
      if (!this.draft.name) {
        new Notice("Type name is required.");
        return;
      }
      if (!this.plugin.mdbaseConfig) return;
      await saveType(this.app.vault, this.plugin.mdbaseConfig, this.draft);
      await this.plugin.reload();
      this.onSave();
      this.close();
      new Notice(`Saved type "${this.draft.name}"`);
    });
  }

  private renderFieldList(el: HTMLElement): void {
    el.empty();
    const fields = this.draft.fields ?? {};
    if (Object.keys(fields).length === 0) {
      el.createDiv({ cls: "mdbase-empty-state", text: "No fields defined." });
      return;
    }

    for (const [name, def] of Object.entries(fields)) {
      const item = el.createDiv({ cls: "mdbase-field-item" });
      const header = item.createDiv({ cls: "mdbase-field-item-header" });

      const titleEl = header.createDiv();
      titleEl.createSpan({ cls: "mdbase-field-item-title", text: name });
      titleEl.createSpan({ cls: "mdbase-field-item-type", text: def.type });
      if (def.required)
        titleEl.createSpan({
          cls: "mdbase-field-item-required",
          text: "*required",
        });

      const actions = header.createDiv({ cls: "mdbase-type-item-actions" });

      const editBtn = actions.createEl("button", { text: "Edit" });
      editBtn.addEventListener("click", () => {
        const modal = new FieldEditorModal(
          this.app,
          name,
          def,
          (newName, newDef) => {
            delete this.draft.fields![name];
            this.draft.fields![newName] = newDef;
            this.render();
          },
        );
        modal.open();
      });

      const delBtn = actions.createEl("button", { text: "Remove" });
      delBtn.addEventListener("click", () => {
        delete this.draft.fields![name];
        this.render();
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class FieldEditorModal extends Modal {
  originalName: string | null;
  originalDef: FieldDef | null;
  onSave: (name: string, def: FieldDef) => void;
  draft: FieldDef;
  draftName: string;

  constructor(
    app: App,
    originalName: string | null,
    originalDef: FieldDef | null,
    onSave: (name: string, def: FieldDef) => void,
  ) {
    super(app);
    this.originalName = originalName;
    this.originalDef = originalDef;
    this.onSave = onSave;
    this.draftName = originalName ?? "";
    this.draft = originalDef
      ? structuredClone(originalDef)
      : { type: "string" };
  }

  onOpen(): void {
    this.titleEl.setText(
      this.originalName ? `Edit field: ${this.originalName}` : "Add field",
    );
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl).setName("Field name").addText((t) =>
      t
        .setValue(this.draftName)
        .setPlaceholder("field_name")
        .onChange((v) => {
          this.draftName = v;
        }),
    );

    new Setting(contentEl).setName("Type").addDropdown((d) => {
      for (const ft of FIELD_TYPES) d.addOption(ft, ft);
      return d.setValue(this.draft.type).onChange((v) => {
        this.draft.type = v as FieldType;
        this.render();
      });
    });

    new Setting(contentEl).setName("Required").addToggle((t) =>
      t.setValue(this.draft.required ?? false).onChange((v) => {
        this.draft.required = v || undefined;
      }),
    );

    new Setting(contentEl).setName("Description").addText((t) =>
      t.setValue(this.draft.description ?? "").onChange((v) => {
        this.draft.description = v || undefined;
      }),
    );

    // Type-specific constraints
    this.renderTypeConstraints(contentEl);

    const actions = contentEl.createDiv({ cls: "mdbase-actions-row" });
    const cancelBtn = actions.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = actions.createEl("button", {
      text: "Save field",
      cls: "mod-cta",
    });
    saveBtn.addEventListener("click", () => {
      if (!this.draftName) {
        new Notice("Field name is required.");
        return;
      }
      this.onSave(this.draftName, this.draft);
      this.close();
    });
  }

  private renderTypeConstraints(el: HTMLElement): void {
    const type = this.draft.type;

    if (type === "string") {
      new Setting(el).setName("Min length").addText((t) =>
        t
          .setValue(String(this.draft.min_length ?? ""))
          .setPlaceholder("0")
          .onChange((v) => {
            this.draft.min_length = v ? parseInt(v) : undefined;
          }),
      );
      new Setting(el).setName("Max length").addText((t) =>
        t.setValue(String(this.draft.max_length ?? "")).onChange((v) => {
          this.draft.max_length = v ? parseInt(v) : undefined;
        }),
      );
      new Setting(el).setName("Pattern (regex)").addText((t) =>
        t.setValue(this.draft.pattern ?? "").onChange((v) => {
          this.draft.pattern = v || undefined;
        }),
      );
    }

    if (type === "integer" || type === "number") {
      new Setting(el).setName("Min").addText((t) =>
        t.setValue(String(this.draft.min ?? "")).onChange((v) => {
          this.draft.min = v ? Number(v) : undefined;
        }),
      );
      new Setting(el).setName("Max").addText((t) =>
        t.setValue(String(this.draft.max ?? "")).onChange((v) => {
          this.draft.max = v ? Number(v) : undefined;
        }),
      );
    }

    if (type === "enum") {
      new Setting(el)
        .setName("Values")
        .setDesc("Comma-separated list of allowed values.")
        .addText((t) =>
          t.setValue((this.draft.values ?? []).join(", ")).onChange((v) => {
            this.draft.values = v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }),
        );
    }

    if (type === "list") {
      new Setting(el).setName("Element type").addDropdown((d) => {
        const elementTypes: FieldType[] = FIELD_TYPES.filter(
          (f) => f !== "list" && f !== "object",
        );
        for (const ft of elementTypes) d.addOption(ft, ft);
        return d.setValue(this.draft.element_type ?? "string").onChange((v) => {
          this.draft.element_type = v as FieldType;
        });
      });
      new Setting(el).setName("Unique elements").addToggle((t) =>
        t.setValue(this.draft.unique_elements ?? false).onChange((v) => {
          this.draft.unique_elements = v || undefined;
        }),
      );
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
