import { defineConfig } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...coreWebVitals,
  {
    // eslint-plugin-react's auto-detectie gebruikt een API die ESLint 10
    // verwijderd heeft; expliciete versie slaat die detectie over.
    settings: { react: { version: "19.2" } },
    ignores: [".next/**", "node_modules/**"],
  },
  {
    // react-pdf's <Image> is geen DOM <img>; alt-text is daar niet van toepassing.
    files: ["lib/pdf/**"],
    rules: { "jsx-a11y/alt-text": "off" },
  },
]);
