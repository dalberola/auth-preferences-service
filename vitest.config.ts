import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
  },
});
