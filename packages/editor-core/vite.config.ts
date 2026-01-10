import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    exclude: [
      "@revolist/revogrid",
      "@revolist/revogrid/loader",
      "tui-grid",
      "tabulator-tables",
    ],
  },
  resolve: {
    alias: {
      "@revolist/revogrid/loader": path.resolve(
        __dirname,
        "../cm6-table-editor/node_modules/@revolist/revogrid/loader/index.js"
      ),
    },
    dedupe: ["@revolist/revogrid"],
  },
});
