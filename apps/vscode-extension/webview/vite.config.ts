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
      "@yuya296/cm6-diff-gutter": path.resolve(
        webviewRoot,
        "../../..",
        "packages/core/cm6-diff-gutter/src/index.ts"
      ),
    },
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
