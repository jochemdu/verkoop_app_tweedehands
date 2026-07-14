import { defineConfig } from "vitest/config";

// Pure JS-unit tests (outbox-store etc). Geen React-Native runtime nodig; native
// modules zoals react-native-mmkv worden per test gemockt (zie *.test.ts).
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
