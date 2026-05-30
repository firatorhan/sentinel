import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentinelPlugin } from "sentinel-vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sentinelPlugin({
      include: ["src/components/**/*.tsx"],
      exclude: ["**/*.stories.tsx", "**/*.test.tsx", "**/ProductButton.tsx"],
    }),
  ],
});
