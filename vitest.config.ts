import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // Only the deterministic, unit-testable core is measured. Excluded below:
      // type-only decls (no runtime), JSON data, and the LLM pipeline / UI /
      // API routes (exercised end-to-end via the recorded demo run + Playwright,
      // not unit tests — they depend on the live Anthropic API or the browser).
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "src/lib/**/types.ts", "src/lib/pipeline/**"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
