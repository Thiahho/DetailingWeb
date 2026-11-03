import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests only. Playwright specs live in e2e/ and run with `pnpm test:e2e`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "app/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    environment: "node",
  },
});
