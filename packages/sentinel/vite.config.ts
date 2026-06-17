import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "classic",
    }),
    tailwindcss(),
    dts({
      include: ["src"],
      tsconfigPath: "./tsconfig.app.json",
    }),
  ],

  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },

  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "sentinel",
      formats: ["es"],
      fileName: (format) => `sentinel.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom"],

    },
  },
});
