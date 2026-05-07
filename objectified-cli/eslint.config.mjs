import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";

export default tseslint.config(
  {
    ignores: [
      "eslint.config.mjs",
      "dist/**",
      "coverage/**",
      "bin/**",
      "scripts/**",
      "**/oclif.manifest.json",
      "src/generated/**",
    ],
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
  {
    files: ["src/**/*.ts"],
    ignores: ["src/lib/client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "\\.\\./generated/|/generated/",
              message:
                "Import OpenAPI types and operations only through src/lib/client.ts (generated client is an implementation detail).",
            },
          ],
        },
      ],
    },
  },
);
