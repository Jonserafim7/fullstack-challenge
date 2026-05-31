import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

// Standalone flat config for the frontend (React + TSX). Mirrors the backend's
// @crash/eslint philosophy — type-aware linting is off (strict tsc covers it),
// Prettier owns formatting — and adds the React Hooks correctness rules.
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".output/**",
      ".nitro/**",
      ".tanstack/**",
      "src/routeTree.gen.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "no-undef": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  eslintConfigPrettier,
);
