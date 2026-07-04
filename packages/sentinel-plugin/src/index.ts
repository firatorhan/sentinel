import { createUnplugin } from "unplugin";
import { createFilter } from "@rollup/pluginutils";
import { transformCode } from "./core/transform";

export interface SentinelPluginOptions {
  include?: string | string[];
  exclude?: string | string[];
  /**
   * When false, no components are wrapped and the @sentinel-core/sentinel
   * package (JS and CSS) resolves to an empty no-op module, so disabled
   * builds ship none of the devtool code. Defaults to true. Apply the plugin
   * unconditionally and drive this from your app config:
   *
   *   sentinelWebpackPlugin({ enabled: appConfig.sentinelEnabled, include: [...] })
   */
  enabled?: boolean;
}

const JSX_EXTENSIONS = [".tsx", ".jsx", ".js"];

const SENTINEL_PACKAGE = "@sentinel-core/sentinel";
const STUB_JS_ID = "\0sentinel-disabled-stub.js";
const STUB_CSS_ID = "\0sentinel-disabled-stub.css";

// Mirrors the package's public runtime exports as no-ops.
const STUB_JS = `
export function Sentinel(props) { return props.children; }
export function SentinelProvider(props) { return props.children; }
export function useSentinelInteraction() { return {}; }
export function useSentinelDialog() { return {}; }
export function voltranExternalLink() { return null; }
export function createSentinelSagaMonitor() { return null; }
export function createSentinelReduxMiddleware() { return null; }
`;

export const sentinelUnplugin = createUnplugin<SentinelPluginOptions>((options = {}, meta) => {
  if (options.enabled === false) {
    // Disabled: wrap nothing and strip the sentinel package from the bundle.
    if (meta.framework === "webpack") {
      // Webpack resolves the package to an empty module via alias — its
      // native mechanism for exactly this. Consumers must keep their own
      // runtime guards (same flag) around sentinel usage.
      return {
        name: "sentinel-plugin",
        webpack(compiler) {
          compiler.options.resolve.alias = {
            ...compiler.options.resolve.alias,
            [`${SENTINEL_PACKAGE}/index.css$`]: false,
            [`${SENTINEL_PACKAGE}$`]: false,
          };
        },
      };
    }
    // Vite/Rollup/esbuild: resolve the package to inline no-op virtual modules.
    return {
      name: "sentinel-plugin",
      enforce: "pre",
      resolveId(id) {
        if (id === SENTINEL_PACKAGE) return STUB_JS_ID;
        if (id.startsWith(`${SENTINEL_PACKAGE}/`)) {
          return id.endsWith(".css") ? STUB_CSS_ID : STUB_JS_ID;
        }
        return null;
      },
      loadInclude(id) {
        return id === STUB_JS_ID || id === STUB_CSS_ID;
      },
      load(id) {
        return id === STUB_CSS_ID ? "" : STUB_JS;
      },
    };
  }

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
