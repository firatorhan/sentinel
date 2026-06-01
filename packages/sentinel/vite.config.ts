import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import path from "path";
import inject from "@rollup/plugin-inject"; // <-- Eklentiyi import et

export default defineConfig({
  plugins: [
    react({
      // React 16.12.0 için burası "classic" kalmalı
      jsxRuntime: "classic", 
    }),
    tailwindcss(),
    dts({
      include: ["src"],
      tsconfigPath: "./tsconfig.app.json",
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "sentinel",
      formats: ["es", "umd"],
      fileName: (format) => `sentinel.${format}.js`,
    },
    rollupOptions: {
      // React paketlerini dışarıda bırakıyoruz
      external: [
        "react", 
        "react-dom", 
        "react/jsx-runtime", 
        "react/jsx-dev-runtime"
      ],
      // ÇÖZÜM: Rollup/Rolldown seviyesinde React objesini modüllere dikiyoruz
      plugins: [
        inject({
          React: "react", // Eğer kodda 'React' kullanılırsa, bunu 'react' paketinden import et
        }),
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "React",
          "react/jsx-dev-runtime": "React"
        },
      },
    },
  },
});