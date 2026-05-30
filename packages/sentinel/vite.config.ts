import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import path from "path";
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      insertTypesEntry: true, // package.json içindeki "types" alanı ile uyumlu çalışır
      include: ["src"], // Sadece src klasöründeki kodların tipini üretir
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "sentinel",
      formats: ["es"],
      fileName: "sentinel",
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
  },
});
