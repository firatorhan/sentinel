import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "Sentinel",
      fileName: "sentinel",
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
  },
});
