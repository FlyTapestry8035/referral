import { defineConfig } from "vitest/config";
import path from "node:path";

// Runs against a real Supabase (local CLI stack). See README "Tests".
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/unit/mocks/server-only.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    setupFiles: ["tests/integration/setup-env.ts"],
  },
});
