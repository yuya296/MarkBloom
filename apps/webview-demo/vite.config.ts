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
      "@yuya296/cm6-markdown-smart-bol": path.resolve(
        configDir,
        "../../packages/core/cm6-markdown-smart-bol/src/index.ts",
      ),
    },
  },
  optimizeDeps: {
    // Keep local workspace packages unbundled in dev so UI tweaks are reflected immediately.
    exclude: [
      "@yuya296/cm6-table",
      "@yuya296/cm6-live-preview",
      "@yuya296/cm6-diff-gutter",
      "@yuya296/cm6-markdown-smart-bol",
    ],
  },
});
