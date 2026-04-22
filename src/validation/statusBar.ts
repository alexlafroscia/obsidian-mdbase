import type MdbasePlugin from "../main.ts";
import type { ValidationIssue } from "../types.ts";
import type { TFile } from "obsidian";

let statusBarItem: HTMLElement | null = null;

export function registerStatusBar(plugin: MdbasePlugin): void {
  statusBarItem = plugin.addStatusBarItem();
  statusBarItem.setText("mdbase");
}

export function refreshStatusBar(
  file: TFile,
  fileIssues: ValidationIssue[],
  hasType: boolean,
): void {
  if (!statusBarItem) return;

  if (!hasType) {
    statusBarItem.setText("mdbase: untyped");
    statusBarItem.className = "";
    return;
  }

  const errors = fileIssues.filter((i) => i.severity === "error").length;
  const warnings = fileIssues.filter((i) => i.severity === "warning").length;

  if (errors > 0) {
    statusBarItem.setText(`mdbase: ${errors} error${errors > 1 ? "s" : ""}`);
    statusBarItem.addClass("mdbase-status-error");
    statusBarItem.removeClass("mdbase-status-warning");
    statusBarItem.removeClass("mdbase-status-ok");
  } else if (warnings > 0) {
    statusBarItem.setText(
      `mdbase: ${warnings} warning${warnings > 1 ? "s" : ""}`,
    );
    statusBarItem.addClass("mdbase-status-warning");
    statusBarItem.removeClass("mdbase-status-error");
    statusBarItem.removeClass("mdbase-status-ok");
  } else {
    statusBarItem.setText("mdbase: ✓");
    statusBarItem.addClass("mdbase-status-ok");
    statusBarItem.removeClass("mdbase-status-error");
    statusBarItem.removeClass("mdbase-status-warning");
  }
}

export function clearStatusBar(): void {
  if (!statusBarItem) return;
  statusBarItem.setText("mdbase: no collection");
}
