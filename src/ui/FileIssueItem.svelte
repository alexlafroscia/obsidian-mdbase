<script lang="ts">
  import type { ValidationIssue } from "../types.ts";

  const { issue }: { issue: ValidationIssue } = $props();

  const meta = $derived(
    [issue.type ? `type: ${issue.type}` : null, issue.code ?? null]
      .filter(Boolean)
      .join(" · "),
  );
</script>

<div class="mdbase-issue-item {issue.severity}">
  <div class="mdbase-issue-field">{issue.field}</div>
  <div class="mdbase-issue-message">{issue.message}</div>
  {#if meta}
    <div class="mdbase-issue-type">{meta}</div>
  {/if}
</div>
