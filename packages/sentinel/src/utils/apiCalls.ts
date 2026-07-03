import { type EffectRecord } from "../saga/createSentinelSagaMonitor";

export type PropMatch = {
  propPath: string;
  preview: string;
  responsePaths: string[];
};

export type ApiCall = {
  effectId: number;
  fnName: string;
  method: string;
  url: string;
  requestHeaders?: Record<string, unknown>;
  requestBody?: unknown;
  responseStatus?: number;
  responseStatusText?: string;
  responseData?: unknown;
  errorMessage?: string;
  effectStatus: EffectRecord["status"];
  duration?: number;
  startedAt: number;
  matchScore: number;
  propMatches?: PropMatch[];
  unmatchedPropPaths?: string[];
  origin: "client" | "server";
};

const safeClone = <T,>(val: unknown): T | undefined => {
  if (val === undefined || val === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(val)) as T;
  } catch {
    return undefined;
  }
};

type AxiosLikeConfig = {
  url?: string;
  method?: string;
  baseURL?: string;
  headers?: Record<string, unknown>;
  data?: unknown;
};

// Works on both raw Axios objects (client monitor) and the serialized
// shape produced by _getSerializableEffects (server effects).
const getAxiosConfig = (val: unknown): AxiosLikeConfig | undefined => {
  if (val === null || typeof val !== "object") return undefined;
  const cfg = (val as { config?: AxiosLikeConfig }).config;
  if (!cfg || typeof cfg !== "object" || typeof cfg.url !== "string") return undefined;
  return cfg;
};

const joinUrl = (baseURL?: string, url?: string): string => {
  if (!url) return baseURL ?? "";
  if (/^https?:\/\//i.test(url) || !baseURL) return url;
  return `${baseURL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
};

const toApiCall = (
  effect: EffectRecord,
  origin: ApiCall["origin"],
  cfg: AxiosLikeConfig,
  response?: Record<string, unknown>,
  errorMessage?: string,
): ApiCall => ({
  origin,
  effectId: effect.id,
  fnName: effect.fnName,
  method: String(cfg.method ?? "get").toUpperCase(),
  url: joinUrl(cfg.baseURL, cfg.url),
  requestHeaders: safeClone(cfg.headers),
  requestBody: typeof cfg.data === "string" ? cfg.data : safeClone(cfg.data),
  responseStatus: typeof response?.status === "number" ? response.status : undefined,
  responseStatusText: typeof response?.statusText === "string" ? response.statusText : undefined,
  responseData: safeClone(response?.data),
  errorMessage,
  effectStatus: effect.status,
  duration: effect.duration,
  startedAt: effect.startedAt,
  matchScore: 0,
});

const MAX_PRIMITIVES = 200;
const MAX_DEPTH = 6;
const MAX_PATHS_PER_VALUE = 3;

// Short strings/numbers ("ok", 0, 1…) match almost anything, so only
// values with 3+ characters count as correlation signal.
const normalize = (val: unknown): string | undefined => {
  if (typeof val === "string") return val.length >= 3 ? val.toLowerCase() : undefined;
  if (typeof val === "number") {
    const s = String(val);
    return s.length >= 3 ? s : undefined;
  }
  return undefined;
};

const previewOf = (val: unknown): string =>
  typeof val === "string" ? `"${val.length > 40 ? `${val.slice(0, 40)}…` : val}"` : String(val);

type Leaf = { path: string; norm: string; preview: string };

const collectLeaves = (val: unknown, path: string, out: Leaf[], depth: number): void => {
  if (out.length >= MAX_PRIMITIVES || depth > MAX_DEPTH || val === null || val === undefined) return;
  const norm = normalize(val);
  if (norm !== undefined) {
    out.push({ path, norm, preview: previewOf(val) });
    return;
  }
  if (typeof val !== "object") return;
  if (Array.isArray(val)) {
    val.forEach((item, i) => collectLeaves(item, `${path}[${i}]`, out, depth + 1));
    return;
  }
  for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
    collectLeaves(v, path ? `${path}.${key}` : key, out, depth + 1);
  }
};

// value → response paths holding that value (a value may occur at several paths)
const valuePathIndex = (data: unknown): Map<string, string[]> => {
  const leaves: Leaf[] = [];
  collectLeaves(data, "", leaves, 0);
  const index = new Map<string, string[]>();
  for (const leaf of leaves) {
    const paths = index.get(leaf.norm);
    if (!paths) index.set(leaf.norm, [leaf.path]);
    else if (paths.length < MAX_PATHS_PER_VALUE) paths.push(leaf.path);
  }
  return index;
};

const matchProps = (
  propLeaves: Leaf[],
  responseData: unknown,
): { matches: PropMatch[]; unmatched: string[] } => {
  if (propLeaves.length === 0 || responseData === null || responseData === undefined) {
    return { matches: [], unmatched: propLeaves.map((l) => l.path) };
  }
  const index = valuePathIndex(responseData);
  const matches: PropMatch[] = [];
  const unmatched: string[] = [];
  for (const leaf of propLeaves) {
    const paths = index.get(leaf.norm);
    if (paths) matches.push({ propPath: leaf.path, preview: leaf.preview, responsePaths: paths });
    else unmatched.push(leaf.path);
  }
  return { matches, unmatched };
};

export const extractApiCalls = (
  effects: EffectRecord[],
  componentProps?: Record<string, unknown>,
  origin: ApiCall["origin"] = "client",
): ApiCall[] => {
  const calls: ApiCall[] = [];

  for (const effect of effects) {
    const resultConfig = getAxiosConfig(effect.result);
    if (resultConfig) {
      calls.push(toApiCall(effect, origin, resultConfig, effect.result as Record<string, unknown>));
      continue;
    }
    // Axios rejections carry the request config (and the response for HTTP errors)
    const errorConfig = getAxiosConfig(effect.error);
    if (errorConfig) {
      const err = effect.error as Record<string, unknown>;
      const response =
        err.response !== null && typeof err.response === "object"
          ? (err.response as Record<string, unknown>)
          : undefined;
      const message = typeof err.message === "string" ? err.message : undefined;
      calls.push(toApiCall(effect, origin, errorConfig, response, message));
    }
  }

  if (componentProps) {
    const propLeaves: Leaf[] = [];
    collectLeaves(componentProps, "", propLeaves, 0);
    for (const call of calls) {
      const { matches, unmatched } = matchProps(propLeaves, call.responseData);
      call.propMatches = matches;
      call.unmatchedPropPaths = unmatched;
      call.matchScore = matches.length;
    }
  }

  return calls.sort((a, b) => b.matchScore - a.matchScore || b.startedAt - a.startedAt);
};

const shellQuote = (val: string): string => `'${val.replace(/'/g, `'\\''`)}'`;

export const buildCurl = (call: ApiCall): string => {
  const parts = [`curl -X ${call.method} ${shellQuote(call.url)}`];
  if (call.requestHeaders) {
    for (const [key, value] of Object.entries(call.requestHeaders)) {
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;
      parts.push(`-H ${shellQuote(`${key}: ${String(value)}`)}`);
    }
  }
  if (call.requestBody !== undefined && call.requestBody !== null) {
    const body =
      typeof call.requestBody === "string" ? call.requestBody : JSON.stringify(call.requestBody);
    parts.push(`-d ${shellQuote(body)}`);
  }
  return parts.join(" \\\n  ");
};
