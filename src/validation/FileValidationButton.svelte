<script lang="ts" module>
  export const SENTINEL_CLASS = "mdbase-validation-btn";
</script>

<script lang="ts">
  import type { TFile } from "obsidian";
  import { ExtraButton, setTooltip } from "obsidian-svelte-ui";

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
  <ExtraButton
    icon={hasIssues ? "triangle-alert" : "checkmark"}
    {onClick}
    {@attach setTooltip(tooltipText)}
    {@attach (node: HTMLElement) => {
      node.classList.add(SENTINEL_CLASS);

      if (hasIssues) {
        node.classList.add("mdbase-validation-btn--invalid");
        node.classList.remove("mdbase-validation-btn--valid");
      } else {
        node.classList.add("mdbase-validation-btn--valid");
        node.classList.remove("mdbase-validation-btn--invalid");
      }
    }}
  />
{/if}
