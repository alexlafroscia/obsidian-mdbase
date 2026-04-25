<script lang="ts">
  import type { ValidationIssue } from "../types.ts";
  import FileSection from "./FileSection.svelte";

  const {
    issuesByFile,
    isSidebar,
    openFile,
  }: {
    issuesByFile: Map<string, ValidationIssue[]>;
    isSidebar: boolean;
    openFile: (path: string) => void;
  } = $props();

  const filesWithIssues = $derived(
    [...issuesByFile.entries()]
      .filter(([, issues]) => issues.length > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

  const totalErrors = $derived(
    filesWithIssues.reduce(
      (sum, [, issues]) =>
        sum + issues.filter((i) => i.severity === "error").length,
      0,
    ),
  );

  const totalWarnings = $derived(
    filesWithIssues.reduce(
      (sum, [, issues]) =>
        sum + issues.filter((i) => i.severity === "warning").length,
      0,
    ),
  );
</script>

<div
  class="mdbase-validation-view"
  class:mdbase-validation-view--sidebar={isSidebar}
>
  {#if filesWithIssues.length === 0}
    <div class="mdbase-empty-state">
      <p>No validation issues found.</p>
      <p class="mdbase-empty-hint">
        Run "Validate all files" to check the vault.
      </p>
    </div>
  {:else}
    <div class="mdbase-validation-header">
      {#if totalErrors > 0}
        <span class="mdbase-summary-count mdbase-summary-count--error"
          >{totalErrors} error{totalErrors !== 1 ? "s" : ""}</span
        >
      {/if}
      {#if totalWarnings > 0}
        <span class="mdbase-summary-count mdbase-summary-count--warning"
          >{totalWarnings} warning{totalWarnings !== 1 ? "s" : ""}</span
        >
      {/if}
      <span class="mdbase-summary-files"
        >in {filesWithIssues.length} file{filesWithIssues.length !== 1
          ? "s"
          : ""}</span
      >
    </div>
    <div class="mdbase-file-list">
      {#each filesWithIssues as [path, issues] (path)}
        <FileSection {path} {issues} compact={isSidebar} {openFile} />
      {/each}
    </div>
  {/if}
</div>
