module.exports = {
  apps: [
    {
      name: "webview-demo",
      cwd: "packages/webview-demo",
      script: "pnpm",
      args: "dev -- --port 5174 --strictPort",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
