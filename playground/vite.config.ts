import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentinelVitePlugin } from "sentinel-plugin";

export default defineConfig({
  plugins: [
    react(),
    sentinelVitePlugin({
      include: ["src/components/**/*.tsx"],
      exclude: ["**/*.stories.tsx", "**/*.test.tsx", "**/ProductButton.tsx"],
    }),
  ],
});
