<script lang="ts" module>
  export const SENTINEL_CLASS = "mdbase-validation-btn";
</script>

<script lang="ts">
  import type { TFile } from "obsidian";
  import { setTooltip } from "obsidian-svelte-ui";

  import type MdbasePlugin from "src/main";
  import { matchFileToTypes } from "src/matching/matcher";

  interface Props {
    file: TFile;
    plugin: MdbasePlugin;
  }

  let { file, plugin }: Props = $props();

  let fm = $derived(
    plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {},
  ) as Record<string, unknown>;
  let matched = $derived(
    plugin.mdbaseConfig
      ? matchFileToTypes(file.path, fm, plugin.types, plugin.mdbaseConfig)
      : [],
  );
  let hasTypes = $derived(matched.length > 0);

  let issues = $derived(plugin.issues.get(file.path) ?? []);
  const hasIssues = $derived(issues.length > 0);

  let errors = $derived(issues.filter((i) => i.severity === "error").length);
  let warnings = $derived(
    issues.filter((i) => i.severity === "warning").length,
  );

  let tooltipText = $derived(
    hasIssues
      ? [
          errors > 0 ? `${errors} error${errors > 1 ? "s" : ""}` : null,
          warnings > 0 ? `${warnings} warning${warnings > 1 ? "s" : ""}` : null,
        ]
          .filter(Boolean)
          .join(", ") + " — click to view"
      : "File passes validation",
  );

  function onClick() {
    plugin.app.commands.executeCommandById(
      "obsidian-mdbase:validate-current-file",
    );
  }
</script>

{#if hasTypes}
  <button
    class={`${SENTINEL_CLASS} clickable-icon ${hasIssues ? "mdbase-validation-btn--invalid" : "mdbase-validation-btn--valid"}`}
    onclick={onClick}
    {@attach setTooltip(tooltipText)}
  >
    {hasIssues ? `⚠ ${issues.length}` : "✓"}
  </button>
{/if}
