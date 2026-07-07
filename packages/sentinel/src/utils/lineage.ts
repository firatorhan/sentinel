import { type EffectRecord } from "../saga/createSentinelSagaMonitor";
import { type ActionRecord } from "../redux/createSentinelReduxMiddleware";
import {
  type ApiCall,
  type Leaf,
  collectLeaves,
  normalize,
  valuePathIndex,
  extractApiCalls,
  correlateProps,
} from "./apiCalls";
import { searchStateByQuery } from "./stateQuery";

export type LineageEntry = {
  propPath: string;
  preview: string;
  statePaths?: string[];
  actionType?: string;
  actionTimestamp?: number;
  actionOrigin?: "client" | "server";
  api?: {
    method: string;
    url: string;
    origin: ApiCall["origin"];
    responsePath?: string;
    // response-value: the prop value literally occurs in this response.
    // saga: linked through the saga task that dispatched the action.
    via: "response-value" | "saga";
  };
};

export type LineageInput = {
  componentProps?: Record<string, unknown>;
  state?: unknown;
  serverState?: unknown;
  clientActions?: ActionRecord[];
  serverActions?: ActionRecord[];
  clientEffects?: EffectRecord[];
  serverEffects?: EffectRecord[];
};

const MAX_STATE_NODES = 60000;
const MAX_STATE_DEPTH = 10;
const MAX_PATHS = 3;
const MAX_ENTRIES = 60;

// Single DFS over the state tree looking only for the given normalized
// values — indexing the whole state would be too expensive.
const searchState = (state: unknown, targets: Set<string>): Map<string, string[]> => {
  const found = new Map<string, string[]>();
  if (state === null || state === undefined || targets.size === 0) return found;
  let visited = 0;
  const walk = (val: unknown, path: string, depth: number): void => {
    if (visited++ > MAX_STATE_NODES || depth > MAX_STATE_DEPTH || val === null || val === undefined) return;
    const norm = normalize(val);
    if (norm !== undefined) {
      if (targets.has(norm)) {
        const paths = found.get(norm) ?? [];
        if (paths.length < MAX_PATHS) {
          paths.push(path);
          found.set(norm, paths);
        }
      }
      return;
    }
    if (typeof val !== "object") return;
    if (Array.isArray(val)) {
      val.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
      walk(v, path ? `${path}.${key}` : key, depth + 1);
    }
  };
  walk(state, "", 0);
  return found;
};

type OriginAction = { record: ActionRecord; origin: "client" | "server" };

const toSegments = (path: string): string[] =>
  path.split(/[.[]/).map((s) => s.replace(/\]$/, "")).filter(Boolean);

// How many leading segments the state path and a diff path share; 0 unless
// one fully prefixes the other.
const prefixDepth = (statePath: string, diffPath: string): number => {
  const s = toSegments(statePath);
  const d = toSegments(diffPath);
  const len = Math.min(s.length, d.length);
  for (let i = 0; i < len; i++) {
    if (s[i] !== d[i]) return 0;
  }
  return len;
};

// The action that wrote the given state path: prefer the deepest diff-path
// overlap (productState.product beats a sibling productState.comparedProducts
// write), then actions whose payload carries the value, then recency.
const findActionForStatePath = (
  statePath: string,
  actions: OriginAction[],
  norm: string,
  payloadNorms: (record: ActionRecord) => Set<string>,
): OriginAction | undefined => {
  let best: OriginAction | undefined;
  let bestDepth = 0;
  let bestHasValue = false;
  for (const candidate of actions) {
    let depth = 0;
    for (const d of candidate.record.diff ?? []) {
      depth = Math.max(depth, prefixDepth(statePath, d.path));
    }
    if (depth === 0) continue;
    const hasValue = payloadNorms(candidate.record).has(norm);
    // actions are sorted newest first, so on full ties the latest wins
    if (depth > bestDepth || (depth === bestDepth && hasValue && !bestHasValue)) {
      best = candidate;
      bestDepth = depth;
      bestHasValue = hasValue;
    }
  }
  return best;
};

// The API call issued by the same saga task that dispatched the action:
// find the PUT effect for the action type, then pick the call whose effect
// shares the nearest ancestor with it (same fork of the saga tree).
const findApiCallForAction = (
  actionType: string,
  effects: EffectRecord[],
  calls: ApiCall[],
): ApiCall | undefined => {
  const puts = effects
    .filter((e) => e.type === "PUT" && e.fnName === actionType)
    .sort((a, b) => b.startedAt - a.startedAt);
  const put = puts[0];
  if (!put) return undefined;

  const byId = new Map(effects.map((e) => [e.id, e]));
  const putAncestors = new Map<number, number>(); // effect id → distance from put
  for (let cur: EffectRecord | undefined = put, d = 0; cur; cur = byId.get(cur.parentId)) {
    putAncestors.set(cur.id, d++);
  }

  let best: ApiCall | undefined;
  let bestDistance = Infinity;
  for (const call of calls) {
    if (call.startedAt > put.startedAt) continue;
    let cur = byId.get(call.effectId);
    while (cur && !putAncestors.has(cur.id)) cur = byId.get(cur.parentId);
    if (!cur) continue;
    const distance = putAncestors.get(cur.id)!;
    if (distance < bestDistance || (distance === bestDistance && call.startedAt > (best?.startedAt ?? 0))) {
      best = call;
      bestDistance = distance;
    }
  }
  return best;
};

export const buildLineage = (input: LineageInput): LineageEntry[] => {
  const {
    componentProps,
    state,
    serverState,
    clientActions = [],
    serverActions = [],
    clientEffects = [],
    serverEffects = [],
  } = input;
  if (!componentProps) return [];

  const propLeaves: Leaf[] = [];
  collectLeaves(componentProps, "", propLeaves, 0);
  if (propLeaves.length === 0) return [];

  const clientCalls = extractApiCalls(clientEffects, componentProps, "client");
  const serverCalls = extractApiCalls(serverEffects, componentProps, "server");
  const calls = correlateProps([...clientCalls, ...serverCalls], componentProps);

  // propPath → strongest value-based response match
  const bestCallByProp = new Map<string, { call: ApiCall; responsePath: string; weight: number }>();
  for (const call of calls) {
    for (const match of call.propMatches ?? []) {
      if (match.weight <= 0) continue;
      const existing = bestCallByProp.get(match.propPath);
      if (!existing || match.weight > existing.weight) {
        bestCallByProp.set(match.propPath, {
          call,
          responsePath: match.responsePaths[0],
          weight: match.weight,
        });
      }
    }
  }

  const targets = new Set(propLeaves.map((l) => l.norm));
  const stateFound = searchState(state ?? serverState, targets);

  const actions: OriginAction[] = [
    ...clientActions.map((record) => ({ record, origin: "client" as const })),
    ...serverActions.map((record) => ({ record, origin: "server" as const })),
  ].sort((a, b) => b.record.timestamp - a.record.timestamp);

  // Lazy per-action index of the values its payload carries (FULFILLED
  // actions embed the API response), used to disambiguate writers.
  const payloadNormCache = new Map<ActionRecord, Set<string>>();
  const payloadNorms = (record: ActionRecord): Set<string> => {
    let norms = payloadNormCache.get(record);
    if (!norms) {
      norms = new Set(valuePathIndex(record.action).keys());
      payloadNormCache.set(record, norms);
    }
    return norms;
  };

  const entries: LineageEntry[] = [];
  for (const leaf of propLeaves) {
    const statePaths = stateFound.get(leaf.norm);
    const valueMatch = bestCallByProp.get(leaf.path);
    if (!statePaths && !valueMatch) continue;

    const entry: LineageEntry = { propPath: leaf.path, preview: leaf.preview };
    if (statePaths) entry.statePaths = statePaths;

    const action = statePaths
      ? findActionForStatePath(statePaths[0], actions, leaf.norm, payloadNorms)
      : undefined;
    if (action) {
      entry.actionType = action.record.action?.type;
      entry.actionTimestamp = action.record.timestamp;
      entry.actionOrigin = action.origin;
    }

    // Keep the chain coherent: the call issued by the saga that dispatched
    // the chosen action wins when it also carries the value; a bare value
    // match is the fallback, a saga link without value evidence comes last.
    let sagaCall: ApiCall | undefined;
    if (action && entry.actionType) {
      const originEffects = action.origin === "client" ? clientEffects : serverEffects;
      const originCalls = action.origin === "client" ? clientCalls : serverCalls;
      sagaCall = findApiCallForAction(entry.actionType, originEffects, originCalls);
    }
    const sagaValueMatch = sagaCall?.propMatches?.find(
      (m) => m.propPath === leaf.path && m.weight > 0,
    );

    if (sagaCall && sagaValueMatch) {
      entry.api = {
        method: sagaCall.method,
        url: sagaCall.url,
        origin: sagaCall.origin,
        responsePath: sagaValueMatch.responsePaths[0],
        via: "response-value",
      };
    } else if (valueMatch) {
      entry.api = {
        method: valueMatch.call.method,
        url: valueMatch.call.url,
        origin: valueMatch.call.origin,
        responsePath: valueMatch.responsePath,
        via: "response-value",
      };
    } else if (sagaCall) {
      entry.api = {
        method: sagaCall.method,
        url: sagaCall.url,
        origin: sagaCall.origin,
        via: "saga",
      };
    }

    entries.push(entry);
    if (entries.length >= MAX_ENTRIES) break;
  }

  // Fullest chains first, then strongest value evidence.
  const completeness = (e: LineageEntry): number =>
    (e.statePaths ? 1 : 0) + (e.actionType ? 1 : 0) + (e.api ? 1 : 0);
  return entries.sort(
    (a, b) =>
      completeness(b) - completeness(a) ||
      (bestCallByProp.get(b.propPath)?.weight ?? 0) - (bestCallByProp.get(a.propPath)?.weight ?? 0),
  );
};

export type QueryLineageEntry = {
  statePath: string;
  preview: string;
  matchType: "path" | "value";
  actionType?: string;
  actionTimestamp?: number;
  actionOrigin?: "client" | "server";
  api?: {
    method: string;
    url: string;
    origin: ApiCall["origin"];
    status?: number;
    duration?: number;
  };
};

export type QueryLineageInput = {
  query: string;
  state?: unknown;
  serverState?: unknown;
  clientActions?: ActionRecord[];
  serverActions?: ActionRecord[];
  clientEffects?: EffectRecord[];
  serverEffects?: EffectRecord[];
};

// buildLineage'in ters yönlü varyantı: componentProps yerine serbest sorgudan
// başlar (MCP senaryosu — tıklanan komponent yok). Zincir aynı yapı taşlarıyla
// kurulur: state path (searchStateByQuery) → action (findActionForStatePath)
// → API call (findApiCallForAction).
export const buildLineageFromQuery = (input: QueryLineageInput): QueryLineageEntry[] => {
  const {
    query,
    state,
    serverState,
    clientActions = [],
    serverActions = [],
    clientEffects = [],
    serverEffects = [],
  } = input;

  const matches = searchStateByQuery(state ?? serverState, query);
  if (matches.length === 0) return [];

  const clientCalls = extractApiCalls(clientEffects, undefined, "client");
  const serverCalls = extractApiCalls(serverEffects, undefined, "server");

  const actions: OriginAction[] = [
    ...clientActions.map((record) => ({ record, origin: "client" as const })),
    ...serverActions.map((record) => ({ record, origin: "server" as const })),
  ].sort((a, b) => b.record.timestamp - a.record.timestamp);

  const payloadNormCache = new Map<ActionRecord, Set<string>>();
  const payloadNorms = (record: ActionRecord): Set<string> => {
    let norms = payloadNormCache.get(record);
    if (!norms) {
      norms = new Set(valuePathIndex(record.action).keys());
      payloadNormCache.set(record, norms);
    }
    return norms;
  };

  const entries: QueryLineageEntry[] = matches.map((match) => {
    const entry: QueryLineageEntry = {
      statePath: match.path,
      preview: match.preview,
      matchType: match.matchType,
    };

    const action = findActionForStatePath(match.path, actions, match.norm ?? "", payloadNorms);
    if (action) {
      entry.actionType = action.record.action?.type;
      entry.actionTimestamp = action.record.timestamp;
      entry.actionOrigin = action.origin;

      if (entry.actionType) {
        const originEffects = action.origin === "client" ? clientEffects : serverEffects;
        const originCalls = action.origin === "client" ? clientCalls : serverCalls;
        const call = findApiCallForAction(entry.actionType, originEffects, originCalls);
        if (call) {
          entry.api = {
            method: call.method,
            url: call.url,
            origin: call.origin,
            status: call.responseStatus,
            duration: call.duration,
          };
        }
      }
    }
    return entry;
  });

  const completeness = (e: QueryLineageEntry): number =>
    (e.actionType ? 1 : 0) + (e.api ? 1 : 0) + (e.matchType === "value" ? 1 : 0);
  return entries.sort((a, b) => completeness(b) - completeness(a));
};
