import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

// Shared flat config for every workspace. Type-aware linting is intentionally
// off — strict `tsc` already covers type safety; this keeps linting fast and
// free of per-package project wiring. Formatting is owned by Prettier;
// eslint-config-prettier (kept last) disables any rules that would conflict.
export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.mjs"],
  },
  {
    files: ["**/*.ts"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // TypeScript resolves identifiers and globals itself, so the core
      // no-undef rule only produces false positives on typed code.
      "no-undef": "off",
    },
  },
  eslintConfigPrettier,
);
