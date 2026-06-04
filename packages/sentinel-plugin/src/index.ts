import { createUnplugin } from "unplugin";
import { createFilter } from "@rollup/pluginutils";
import { transformCode } from "./core/transform";

export interface SentinelPluginOptions {
  include?: string | string[];
  exclude?: string | string[];
}

export const sentinelUnplugin = createUnplugin<SentinelPluginOptions>((options = {}, meta) => {
  const filter = createFilter(
    options.include ?? ["**/*.tsx"],
    options.exclude ?? [],
  );

  return {
    name: "sentinel-plugin",
    enforce: "pre",

    transformInclude(id) {
      if (id.includes("node_modules")) return false;
      if (!id.endsWith(".tsx")) return false;
      return filter(id);
    },

    transform(code, id) {
      // Build context'indeki addWatchFile metodunu transformCode'a paslıyoruz
      const addWatchFile = typeof (this as any)?.addWatchFile === "function" 
        ? (path: string) => (this as any).addWatchFile(path) 
        : undefined;

      return transformCode(code, id, addWatchFile);
    },
  };
});

// Build araçları için özelleştirilmiş export'lar
export const sentinelVitePlugin = sentinelUnplugin.vite;
export const sentinelWebpackPlugin = sentinelUnplugin.webpack;
export const sentinelRollupPlugin = sentinelUnplugin.rollup;
export const sentinelEsbuildPlugin = sentinelUnplugin.esbuild;