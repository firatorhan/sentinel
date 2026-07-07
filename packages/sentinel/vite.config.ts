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

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
) as { version: string };

export default defineConfig({
  define: {
    __SENTINEL_VERSION__: JSON.stringify(pkg.version),
  },
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
    target: "es2019",
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        core: path.resolve(__dirname, "src/core.ts"),
      },
      name: "Sentinel",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        const base = entryName === "index" ? "sentinel" : entryName;
        return format === "cjs" ? `${base}.cjs` : `${base}.${format}.js`;
      },
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
  },
});
