import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webviewRoot = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = path.resolve(webviewRoot, "..", "..", "..");

export default defineConfig({
  root: webviewRoot,
  base: "./",
  resolve: {
    alias: {
      "@yuya296/cm6-table": path.resolve(
        webviewRoot,
        "../../..",
        "packages/core/cm6-table/src/index.ts"
      ),
      "@yuya296/cm6-diff-gutter": path.resolve(
        webviewRoot,
        "../../..",
        "packages/core/cm6-diff-gutter/src/index.ts"
      ),
      "@yuya296/cm6-live-preview": path.resolve(
        webviewRoot,
        "../../..",
        "packages/core/cm6-live-preview/src/index.ts"
      ),
      "@yuya296/cm6-markdown-smart-bol": path.resolve(
        webviewRoot,
        "../../..",
        "packages/core/cm6-markdown-smart-bol/src/index.ts"
      ),
    },
  },
  optimizeDeps: {
    exclude: [
      "@yuya296/cm6-table",
      "@yuya296/cm6-live-preview",
      "@yuya296/cm6-diff-gutter",
      "@yuya296/cm6-markdown-smart-bol",
    ],
  },
  build: {
    outDir: path.resolve(webviewRoot, "..", "dist", "webview"),
    emptyOutDir: true,
    manifest: true,
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
});
