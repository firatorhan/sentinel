import { type EffectRecord } from "../saga/createSentinelSagaMonitor";
import { safeClone } from "./safeClone";
import { getPreview } from "./stateSearch";

export type PropMatch = {
  propPath: string;
  preview: string;
  responsePaths: string[];
  // IDF weight: how distinctive this value is across all captured responses.
  // 0 means the value occurs in every response and carries no signal.
  weight: number;
};

export type ApiCall = {
  effectId: number;
  // Position within a batched effect result (e.g. one getFragments call
  // fanning out to N fragment requests); keeps React keys unique.
  subIndex?: number;
  // True when the component's fragment id points at this call directly,
  // independent of fuzzy value matching.
  directMatch?: boolean;
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

// Batched effects (Voltran getFragments) resolve to an array of settle
// contexts: {result: axiosResponse | axiosError, ...}. Bare axios values
// inside plain arrays are supported too.
const unwrapSettled = (entry: unknown): unknown => {
  if (entry !== null && typeof entry === "object" && "result" in (entry as Record<string, unknown>)) {
    return (entry as Record<string, unknown>).result;
  }
  return entry;
};

// An axios response has a top-level status; an axios error carries the
// config plus message/response instead.
const isResponseLike = (val: Record<string, unknown>): boolean => "status" in val;

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

const MAX_PRIMITIVES = 400;
// Responses get a higher budget: big payloads (product detail) hold the
// interesting values deep past the prop-side cap, and a truncated index
// makes the correlation pick a smaller, unrelated response instead.
const MAX_RESPONSE_PRIMITIVES = 2000;
const MAX_DEPTH = 6;
const MAX_PATHS_PER_VALUE = 3;

// Short strings/numbers ("ok", 0, 1…) match almost anything, so only
// values with 3+ characters count as correlation signal.
export const normalize = (val: unknown): string | undefined => {
  if (typeof val === "string") return val.length >= 3 ? val.toLowerCase() : undefined;
  if (typeof val === "number") {
    const s = String(val);
    return s.length >= 3 ? s : undefined;
  }
  return undefined;
};

export type Leaf = { path: string; norm: string; preview: string };

export const collectLeaves = (
  val: unknown,
  path: string,
  out: Leaf[],
  depth: number,
  max: number = MAX_PRIMITIVES,
): void => {
  if (out.length >= max || depth > MAX_DEPTH || val === null || val === undefined) return;
  const norm = normalize(val);
  if (norm !== undefined) {
    out.push({ path, norm, preview: getPreview(val) });
    return;
  }
  if (typeof val !== "object") return;
  if (Array.isArray(val)) {
    val.forEach((item, i) => collectLeaves(item, `${path}[${i}]`, out, depth + 1, max));
    return;
  }
  for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
    collectLeaves(v, path ? `${path}.${key}` : key, out, depth + 1, max);
  }
};

// value → response paths holding that value (a value may occur at several paths)
export const valuePathIndex = (data: unknown): Map<string, string[]> => {
  const leaves: Leaf[] = [];
  collectLeaves(data, "", leaves, 0, MAX_RESPONSE_PRIMITIVES);
  const index = new Map<string, string[]>();
  for (const leaf of leaves) {
    const paths = index.get(leaf.norm);
    if (!paths) index.set(leaf.norm, [leaf.path]);
    else if (paths.length < MAX_PATHS_PER_VALUE) paths.push(leaf.path);
  }
  return index;
};

// Correlates component props with the responses of the given calls (client
// and server merged — IDF frequencies are only meaningful over the full set).
// A prop value scores by how distinctive it is: values occurring in every
// response (culture, store ids…) weigh 0 and can't flag a call as matched.
export const correlateProps = (
  calls: ApiCall[],
  componentProps?: Record<string, unknown>,
): ApiCall[] => {
  if (!componentProps) return calls;
  const propLeaves: Leaf[] = [];
  collectLeaves(componentProps, "", propLeaves, 0);

  const indexes = calls.map((call) => valuePathIndex(call.responseData));

  const totalCalls = calls.length;
  const docFrequency = new Map<string, number>();
  for (const leaf of propLeaves) {
    if (docFrequency.has(leaf.norm)) continue;
    docFrequency.set(leaf.norm, indexes.filter((index) => index.has(leaf.norm)).length);
  }
  // With a single call there is no cross-call signal; every match counts as 1.
  // Values occurring in more than half the responses (boilerplate like
  // "stylesheet", shared config values…) carry no correlation signal at all —
  // a soft IDF weight alone still lets them flag a call as matched.
  const idf = (norm: string): number => {
    const df = docFrequency.get(norm) ?? 0;
    if (df === 0) return 0;
    if (totalCalls <= 1) return 1;
    if (df > totalCalls / 2) return 0;
    return Math.log(totalCalls / df);
  };

  calls.forEach((call, i) => {
    const index = indexes[i];
    const matches: PropMatch[] = [];
    const unmatched: string[] = [];
    let score = 0;
    for (const leaf of propLeaves) {
      const paths = index.get(leaf.norm);
      if (paths) {
        const weight = idf(leaf.norm);
        matches.push({ propPath: leaf.path, preview: leaf.preview, responsePaths: paths, weight });
        score += weight;
      } else {
        unmatched.push(leaf.path);
      }
    }
    call.propMatches = matches.sort((a, b) => b.weight - a.weight);
    call.unmatchedPropPaths = unmatched;
    call.matchScore = score;
  });

  return calls;
};

// Fallback when the response body doesn't echo the fragment id: resolve the
// fragment config for that id from the effect args and compare its URL path
// against the call URL. Id-based lookup sidesteps index misalignment between
// args and results (server skips onlyClientSide fragments).
const urlMatchesFragmentArg = (
  effect: EffectRecord | undefined,
  fragmentId: string,
  callUrl: string,
): boolean => {
  if (!effect || !Array.isArray(effect.args?.[0])) return false;
  const config = (effect.args[0] as Record<string, unknown>[]).find((c) => c?.id === fragmentId);
  if (!config) return false;
  const customApiUrl = config.customApiUrl as Record<string, unknown> | undefined;
  const path =
    config.clientUrl ?? config.url ?? customApiUrl?.clientUrl ?? customApiUrl?.serverUrl;
  if (typeof path !== "string" || path.length === 0) return false;
  return callUrl.includes(path.replace(/^\//, ""));
};

// Fragment ids requested by these effects that also occur anywhere in the
// component's props — direct evidence the request produced the selected
// component, regardless of which prop holds the id (works for
// fragmentInfo.id, a bare id, or a layout's fragments map alike).
export const detectFragmentIds = (
  effects: EffectRecord[],
  componentProps?: Record<string, unknown>,
): string[] => {
  if (!componentProps) return [];
  const knownIds = new Map<string, string>(); // lowercased → original
  for (const effect of effects) {
    if (!Array.isArray(effect.args?.[0])) continue;
    for (const config of effect.args[0] as Record<string, unknown>[]) {
      if (typeof config?.id === "string" && config.id.length >= 3) {
        knownIds.set(config.id.toLowerCase(), config.id);
      }
    }
  }
  if (knownIds.size === 0) return [];
  const propLeaves: Leaf[] = [];
  collectLeaves(componentProps, "", propLeaves, 0);
  const referenced = new Set<string>();
  for (const leaf of propLeaves) {
    const id = knownIds.get(leaf.norm);
    if (id) referenced.add(id);
  }
  return [...referenced];
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
    // Batched result: fan the array out into one ApiCall per entry
    if (Array.isArray(effect.result)) {
      effect.result.forEach((entry, subIndex) => {
        const settled = unwrapSettled(entry);
        const cfg = getAxiosConfig(settled);
        if (!cfg) return;
        const val = settled as Record<string, unknown>;
        if (isResponseLike(val)) {
          calls.push({ ...toApiCall(effect, origin, cfg, val), subIndex });
          return;
        }
        // Axios error settled as a value: response lives under .response
        const response =
          val.response !== null && typeof val.response === "object"
            ? (val.response as Record<string, unknown>)
            : undefined;
        const message = typeof val.message === "string" ? val.message : undefined;
        calls.push({ ...toApiCall(effect, origin, cfg, response, message), subIndex });
      });
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

  // Fuzzy prop correlation lives in correlateProps, which must run over the
  // merged client+server call list; only id-based direct matching happens
  // here because it needs this origin's effect args.
  const referencedIds = detectFragmentIds(effects, componentProps);
  if (referencedIds.length > 0) {
    const effectById = new Map(effects.map((e) => [e.id, e]));
    for (const call of calls) {
      const responseId = (call.responseData as Record<string, unknown> | undefined)?.id;
      const matches =
        (typeof responseId === "string" && referencedIds.includes(responseId)) ||
        referencedIds.some((id) =>
          urlMatchesFragmentArg(effectById.get(call.effectId), id, call.url),
        );
      if (matches) call.directMatch = true;
    }
  }

  return calls.sort(sortApiCalls);
};

export const sortApiCalls = (a: ApiCall, b: ApiCall): number =>
  Number(b.directMatch ?? false) - Number(a.directMatch ?? false) ||
  b.matchScore - a.matchScore ||
  b.startedAt - a.startedAt;

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
