import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webviewRoot = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = path.resolve(webviewRoot, "..", "..", "..");

export default defineConfig({
  root: webviewRoot,
  base: "./",
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
