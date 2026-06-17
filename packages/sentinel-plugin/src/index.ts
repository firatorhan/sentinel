import { createUnplugin } from "unplugin";
import { createFilter } from "@rollup/pluginutils";
import { transformCode } from "./core/transform";

export interface SentinelPluginOptions {
  include?: string | string[];
  exclude?: string | string[];
}

const JSX_EXTENSIONS = [".tsx", ".jsx", ".js"];

export const sentinelUnplugin = createUnplugin<SentinelPluginOptions>((options = {}, meta) => {
  const filter = createFilter(
    options.include ?? ["**/*.tsx", "**/*.jsx"],
    options.exclude ?? [],
  );

  return {
    name: "sentinel-plugin",
    enforce: "pre",

    transformInclude(id) {
      if (id.includes("node_modules")) return false;
      if (!JSX_EXTENSIONS.some((ext) => id.endsWith(ext))) return false;
      return true;
    },

    transform(code, id) {
      const isInInclude = filter(id);
      if (!isInInclude && !code.includes("@sentinel-watch")) return null;

      const addWatchFile = typeof (this as any)?.addWatchFile === "function"
        ? (path: string) => (this as any).addWatchFile(path)
        : undefined;

      return transformCode(code, id, isInInclude, addWatchFile);
    },
  };
});

// Build araçları için özelleştirilmiş export'lar
export const sentinelVitePlugin = sentinelUnplugin.vite;
export const sentinelWebpackPlugin = sentinelUnplugin.webpack;
export const sentinelRollupPlugin = sentinelUnplugin.rollup;
export const sentinelEsbuildPlugin = sentinelUnplugin.esbuild;