import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import path from "path";
import fs from "fs";

const addImportantToSentinelRules = (): Plugin => ({
  name: "sentinel:add-important",
  apply: "build",
  closeBundle() {
    const cssPath = path.resolve(__dirname, "dist/sentinel.css");
    if (!fs.existsSync(cssPath)) return;

    const css = fs.readFileSync(cssPath, "utf-8");
    const modified = css.replace(
      /(\.sentinel-root[^{]*)\{([^}]*)\}/g,
      (_match, selector, declarations) => {
        const normalized = declarations.trimEnd();
        const withSemi = normalized.endsWith(";") ? normalized : normalized + ";";
        const withImportant = withSemi.replace(
          /([^;!{}]+?)(\s*!important)?\s*;/g,
          "$1 !important;",
        );
        return `${selector}{${withImportant}}`;
      },
    );
    fs.writeFileSync(cssPath, modified);
  },
});

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "classic",
    }),
    tailwindcss(),
    addImportantToSentinelRules(),
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
      name: "Sentinel",
      formats: ["es", "cjs"],
      fileName: (format) => format === "cjs" ? "sentinel.cjs" : `sentinel.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
  },
});
