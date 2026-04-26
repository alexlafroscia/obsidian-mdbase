import { sveltePreprocess } from "svelte-preprocess";

export default {
  compilerOptions: { css: "injected" },
  preprocess: sveltePreprocess(),
};
