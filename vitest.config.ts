import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "dist", ".next"],
    coverage: {
      provider: "v8",
      include: ["apps/backend/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/node_modules/**"],
    },
  },
});
