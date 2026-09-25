// ESLint 9 flat config. Enforces the dependency direction from docs/ARCHITECTURE.md:
//   core ← data ← bridge ← ui/board   (core imports nothing from the app; data only core; bridge core+data)
// plus React hooks rules and the TypeScript recommended set.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const noReactOrTauri = [
  { name: "react", message: "core/ and data/ are framework-free (D-003)." },
  { name: "react-dom", message: "core/ and data/ are framework-free (D-003)." },
  { name: "@tauri-apps/api", message: "Only src/bridge may talk to Tauri (D-009)." },
  { name: "@tauri-apps/plugin-dialog", message: "Only src/bridge may talk to Tauri (D-009)." },
  { name: "@tauri-apps/plugin-opener", message: "Only src/bridge may talk to Tauri (D-009)." },
];

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "src-tauri/**", "e2e/**", "playwright.config.ts", "vite.config.ts", "eslint.config.js"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: noReactOrTauri,
          patterns: [
            { group: ["../data/*", "../../data/*", "**/src/data/**"], message: "core must not import data (dependency direction core ← data)." },
            { group: ["../ui/*", "../../ui/*", "**/src/ui/**", "../board/*", "../../board/*", "**/src/board/**"], message: "core must not import ui/board." },
            { group: ["../bridge/*", "../../bridge/*", "**/src/bridge/**"], message: "core must not import bridge." },
          ],
        },
      ],
      "no-restricted-globals": ["error", { name: "window", message: "core is DOM-free; use globalThis guards." }, { name: "document", message: "core is DOM-free." }],
    },
  },
  {
    files: ["src/data/**/*.ts"],
    ignores: ["src/data/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: noReactOrTauri,
          patterns: [
            { group: ["../ui/*", "../../ui/*", "**/src/ui/**", "../board/*", "../../board/*", "**/src/board/**"], message: "data must not import ui/board." },
            { group: ["../bridge/*", "../../bridge/*", "**/src/bridge/**"], message: "data must not import bridge (bridge adapts data, not the reverse)." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/bridge/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "react", message: "bridge is React-free." }, { name: "react-dom", message: "bridge is React-free." }],
          patterns: [{ group: ["../ui/*", "../../ui/*", "**/src/ui/**", "../board/*", "../../board/*", "**/src/board/**"], message: "bridge must not import ui/board." }],
        },
      ],
    },
  },
);
