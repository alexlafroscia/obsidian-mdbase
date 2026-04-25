<script lang="ts">
  import type { ValidationIssue } from "../types.ts";
  import FileIssueItem from "./FileIssueItem.svelte";

  const {
    path,
    issues,
    compact,
    openFile,
  }: {
    path: string;
    issues: ValidationIssue[];
    compact: boolean;
    openFile: (path: string) => void;
  } = $props();

  const filename = $derived(path.split("/").pop() ?? path);
  const folder = $derived(
    path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "",
  );
  const errors = $derived(
    issues.filter((i) => i.severity === "error").length,
  );
  const warnings = $derived(
    issues.filter((i) => i.severity === "warning").length,
  );
</script>

<div
  class="mdbase-file-section"
  class:mdbase-file-section--compact={compact}
>
  <div class="mdbase-file-header">
    <div class="mdbase-file-title-group">
      <button class="mdbase-file-title-btn" onclick={() => openFile(path)}>
        {filename}
      </button>
      {#if folder && !compact}
        <span class="mdbase-file-folder">{folder}</span>
      {/if}
    </div>
    {#if !compact}
      <div class="mdbase-file-counts">
        {#if errors > 0}
          <span class="mdbase-count mdbase-count--error"
            >{errors} error{errors !== 1 ? "s" : ""}</span
          >
        {/if}
        {#if warnings > 0}
          <span class="mdbase-count mdbase-count--warning"
            >{warnings} warning{warnings !== 1 ? "s" : ""}</span
          >
        {/if}
      </div>
    {/if}
  </div>
  <div class="mdbase-issue-list mdbase-issue-list--file">
    {#each issues as issue (`${issue.field}-${issue.code}`)}
      <FileIssueItem {issue} {compact} />
    {/each}
  </div>
</div>
