import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Resolve cm6-table to source during local development to avoid stale workspace dist cache.
    alias: {
      "@yuya296/cm6-table": path.resolve(configDir, "../cm6-table/src/index.ts"),
    },
  },
  optimizeDeps: {
    // Keep local workspace packages unbundled in dev so UI tweaks are reflected immediately.
    exclude: [
      "@yuya296/cm6-table",
      "@yuya296/cm6-live-preview",
      "@yuya296/cm6-table-editor-vanilla",
      "@yuya296/cm6-table-editor-tabulator",
      "@yuya296/cm6-table-editor-handsontable5",
      "@yuya296/cm6-table-editor-jspreadsheet",
      "@yuya296/cm6-table-editor-aggrid",
    ],
  },
});
