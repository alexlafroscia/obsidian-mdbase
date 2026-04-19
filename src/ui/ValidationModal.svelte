<script lang="ts">
  import type { ValidationIssue } from "../types.ts";
  import FileIssueItem from "./FileIssueItem.svelte";

  const { issues }: { issues: ValidationIssue[] } = $props();
</script>

<div class="mdbase-validation-modal">
  {#if issues.length === 0}
    <p class="mdbase-status-ok">No issues found. ✓</p>
  {:else}
    <div class="mdbase-issue-list">
      {#each issues as issue (issue.field + issue.code)}
        <FileIssueItem {issue} />
      {/each}
    </div>
  {/if}
</div>
