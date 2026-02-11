import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

const configDir = dirname(fileURLToPath(import.meta.url));
const workspaceTypeScriptSources = [
  "apps/*/src/**/*.ts",
  "packages/core/*/src/**/*.ts",
];
const workspaceTsconfigProjects = [
  "apps/*/tsconfig.json",
  "packages/core/*/tsconfig.json",
];

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.*/**",
      "**/coverage/**",
      "**/out/**",
      "**/build/**",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: workspaceTypeScriptSources,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        project: workspaceTsconfigProjects,
        tsconfigRootDir: configDir,
      },
    },
  })),
];
