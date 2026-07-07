import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },
  test: {
    environment: "node",
  },
});
