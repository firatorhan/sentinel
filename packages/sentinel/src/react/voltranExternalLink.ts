import { type ExternalLink } from "./provider";
import { type EffectRecord } from "../saga/createSentinelSagaMonitor";

type VoltranExternalLinkOptions = {
  label?: string;
  baseUrl?: string;
  preview?: boolean;
};

const withPreview = (url: string): string =>
  url + (url.includes("?") ? "&" : "?") + "preview";

const resolveUrl = (path: string, baseUrl?: string): string => {
  if (path.startsWith("http")) return path;
  if (baseUrl && path) return baseUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
  return "";
};

const findVoltranUrl = (fragmentId: unknown, sagaEffects: EffectRecord[], baseUrl?: string): string => {
  for (const effect of sagaEffects) {
    if (effect.fnName !== "getFragments" || !Array.isArray(effect.args?.[0])) continue;
    const idx = (effect.args[0] as any[]).findIndex((c) => c.id === fragmentId);
    if (idx === -1) continue;

    // client-side: Axios result has config.url + config.params
    if (Array.isArray(effect.result)) {
      const config = (effect.result as any[])[idx]?.result?.config;
      if (config?.url) {
        const params =
          config.params && Object.keys(config.params).length
            ? "?" + new URLSearchParams(config.params).toString()
            : "";
        return config.url + params;
      }
    }

    // server-side fallback: URL is in args[0][idx]
    const fragmentConfig = (effect.args[0] as any[])[idx];
    const path: string =
      fragmentConfig?.clientUrl ||
      fragmentConfig?.url ||
      fragmentConfig?.customApiUrl?.clientUrl ||
      fragmentConfig?.customApiUrl?.serverUrl ||
      "";
    const resolved = resolveUrl(path, baseUrl);
    if (resolved) {
      const paramater = fragmentConfig?.paramater;
      const params =
        paramater && typeof paramater === "object" && Object.keys(paramater).length
          ? "?" + new URLSearchParams(paramater).toString()
          : "";
      return resolved + params;
    }
  }
  return "";
};

export const voltranExternalLink = (options: VoltranExternalLinkOptions = {}): ExternalLink => ({
  label: options.label ?? "Open in Microfrontend",
  match: (_name, props) => props?.fragmentInfo?.id != null,
  url: (props, sagaEffects) => {
    const found = findVoltranUrl(props.fragmentInfo?.id, sagaEffects, options.baseUrl);
    return found && options.preview === true ? withPreview(found) : found;
  },
});
