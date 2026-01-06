import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

const configDir = dirname(fileURLToPath(import.meta.url));

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
    files: ["packages/*/src/**/*.ts"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        project: ["packages/*/tsconfig.json"],
        tsconfigRootDir: configDir,
      },
    },
  })),
];
