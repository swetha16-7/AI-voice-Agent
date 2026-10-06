import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 10000,
    env: {
      // Needed so @workspace/db can be imported without throwing at module load.
      // The actual DB connection is never used in tests since db is vi.mock'd.
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_db",
    },
  },
});
