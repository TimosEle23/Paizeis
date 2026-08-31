import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // mongodb-memory-server can be slow to spin up the first time.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
    /**
     * One file at a time.
     *
     * Every suite starts its own MongoDB replica set, so running five in
     * parallel means five mongod processes competing for the machine. That
     * contention produced intermittent failures — a 404 where a 409 belonged,
     * an invitation query returning nothing — that never reproduced in
     * isolation. Determinism is worth more here than the few seconds saved.
     */
    fileParallelism: false,
  },
});
