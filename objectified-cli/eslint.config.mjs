import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";

export default tseslint.config(
  {
    ignores: ["eslint.config.mjs", "dist/**", "coverage/**", "bin/**", "**/oclif.manifest.json"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)),
        },
      },
    },
  {
    files: ["test/**/*.ts", "vitest.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
);
