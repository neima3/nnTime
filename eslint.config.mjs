import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees (each carries its own .next/ and node_modules/) —
    // without this, any in-repo worktree fails the host checkout's lint.
    ".claude/worktrees/**",
    // Git-ignored QA evidence and scripts (browser-qa is not product code).
    "browser-qa/**",
  ]),
]);

export default eslintConfig;
