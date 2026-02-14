import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  resolve: {
    // Resolve cm6-table to source during local development to avoid stale workspace dist cache.
    alias: {
      "@yuya296/cm6-table": path.resolve(
        configDir,
        "../../packages/core/cm6-table/src/index.ts",
      ),
      "@yuya296/cm6-diff-gutter": path.resolve(
        configDir,
        "../../packages/core/cm6-diff-gutter/src/index.ts",
      ),
      "@yuya296/cm6-live-preview": path.resolve(
        configDir,
        "../../packages/core/cm6-live-preview/src/index.ts",
      ),
      "@yuya296/cm6-live-preview-core": path.resolve(
        configDir,
        "../../packages/core/cm6-live-preview-core/src/index.ts",
      ),
      "@yuya296/cm6-markdown-semantics": path.resolve(
        configDir,
        "../../packages/core/cm6-markdown-semantics/src/index.ts",
      ),
      "@yuya296/cm6-typography-theme": path.resolve(
        configDir,
        "../../packages/core/cm6-typography-theme/src/index.ts",
      ),
      "@yuya296/cm6-live-preview-mermaid": path.resolve(
        configDir,
        "../../packages/core/cm6-live-preview-mermaid/src/index.ts",
      ),
      "@codemirror/state": path.resolve(
        configDir,
        "node_modules/@codemirror/state",
      ),
      "@codemirror/view": path.resolve(
        configDir,
        "node_modules/@codemirror/view",
      ),
      "@codemirror/language": path.resolve(
        configDir,
        "node_modules/@codemirror/language",
      ),
      "@codemirror/lang-markdown": path.resolve(
        configDir,
        "node_modules/@codemirror/lang-markdown",
      ),
    },
  },
  optimizeDeps: {
    // Keep local workspace packages unbundled in dev so UI tweaks are reflected immediately.
    exclude: [
      "@yuya296/cm6-table",
      "@yuya296/cm6-live-preview",
      "@yuya296/cm6-live-preview-core",
      "@yuya296/cm6-markdown-semantics",
      "@yuya296/cm6-typography-theme",
      "@yuya296/cm6-live-preview-mermaid",
      "@yuya296/cm6-diff-gutter",
    ],
  },
});
