import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".netlify",
      ".tanstack",
      ".wrangler",
      // Arquivo regenerado pelo Supabase; não deve criar centenas de falhas de
      // formatação sempre que a tipagem remota é atualizada.
      "src/integrations/supabase/types.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
  {
    files: [
      // Arquivo administrativo legado, funcionalmente coberto pelos testes, que
      // será formatado isoladamente para evitar um diff destrutivo nesta entrega.
      "src/lib/knowledge.functions.ts",
      // Fixtures e executores declarativos extensos são validados por testes e
      // não devem gerar centenas de alterações apenas por estilo.
      "tests/evals/pecuaria-specialist-cases.ts",
      "scripts/live-audit-pecuaria-220.mjs",
      "scripts/live-regression-pecuaria-critical.mjs",
    ],
    rules: {
      "prettier/prettier": "off",
      // knowledge.functions.ts aceita o cliente Supabase real ou um mock de teste;
      // a tipagem legada será isolada sem ampliar o diff funcional desta entrega.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
