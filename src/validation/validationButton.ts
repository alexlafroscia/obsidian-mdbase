import { setTooltip } from "obsidian";
import type MdbasePlugin from "../main.ts";

const SENTINEL_CLASS = "mdbase-validation-btn";

function inject(plugin: MdbasePlugin, container: Element) {
  if (container.querySelector(`.${SENTINEL_CLASS}`)) return;

  const addBtn = container.querySelector(".metadata-add-button");
  if (!addBtn) return;

  const file = plugin.app.workspace.getActiveFile();
  const issues = file ? (plugin.issues.get(file.path) ?? []) : [];
  const hasIssues = issues.length > 0;

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  const btn = createEl("button", {
    cls: `${SENTINEL_CLASS} clickable-icon ${hasIssues ? "mdbase-validation-btn--invalid" : "mdbase-validation-btn--valid"}`,
  });
  btn.setText(hasIssues ? `⚠ ${issues.length}` : "✓");

  const tooltipText = hasIssues
    ? [
        errors > 0 ? `${errors} error${errors > 1 ? "s" : ""}` : null,
        warnings > 0 ? `${warnings} warning${warnings > 1 ? "s" : ""}` : null,
      ]
        .filter(Boolean)
        .join(", ") + " — click to view"
    : "File passes validation";
  setTooltip(btn, tooltipText, { placement: "top" });
  btn.addEventListener("click", () => {
    plugin.app.commands.executeCommandById(
      "obsidian-mdbase:validate-current-file",
    );
  });

  addBtn.insertAdjacentElement("afterend", btn);
}

function refresh(plugin: MdbasePlugin) {
  const containers = plugin.app.workspace.containerEl.querySelectorAll(
    ".metadata-container",
  );
  for (const container of containers) {
    container.querySelector(`.${SENTINEL_CLASS}`)?.remove();
    inject(plugin, container);
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
