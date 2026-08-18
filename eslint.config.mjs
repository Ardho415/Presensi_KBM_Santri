import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Proyek ini secara sengaja memakai `any` di banyak tempat untuk
      // payload API/Supabase yang bentuknya dinamis; type ketat tidak
      // memberi nilai tambah berarti di sini.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      // Aturan react-hooks baru (React Compiler) ini masih cukup ketat
      // untuk pola "load data di mount" yang umum dipakai di seluruh
      // halaman dashboard; dimatikan secara sadar, bukan karena bug.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
