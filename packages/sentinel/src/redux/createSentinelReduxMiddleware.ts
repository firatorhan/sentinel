import { safeClone } from "../utils/safeClone";

const DEFAULT_MAX_RECORDS = 50;
let _id = 0;

export type SentinelReduxMiddlewareOptions = {
  maxRecords?: number;
};

export type DiffType = "added" | "removed" | "changed";

export type DiffEntry = {
  path: string;
  type: DiffType;
  prev?: unknown;
  next?: unknown;
};

export type ActionRecord = {
  id: number;
  action: { type: string; [key: string]: unknown };
  diff: DiffEntry[];
  timestamp: number;
};

export type SentinelReduxMiddleware = {
  middleware: (store: { getState(): unknown }) => (next: (action: unknown) => unknown) => (action: unknown) => unknown;
  _getRecords(): ActionRecord[];
  _getSerializableRecords(): ActionRecord[];
  _subscribe(listener: () => void): () => void;
  _clear(): void;
};

const MAX_DIFF_DEPTH = 5;
const MAX_DIFF_ENTRIES = 60;

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

// Deep diff pruned by reference equality: redux reducers keep untouched
// branches identical, so we only descend into what an action actually
// changed. Deep paths let consumers tell productState.product apart from
// productState.comparedProducts.
function collectDiff(
  prev: unknown,
  next: unknown,
  path: string,
  out: DiffEntry[],
  depth: number,
): void {
  if (out.length >= MAX_DIFF_ENTRIES || prev === next) return;

  const bothObjects = isObj(prev) && isObj(next);
  const bothArrays = Array.isArray(prev) && Array.isArray(next);
  if (depth >= MAX_DIFF_DEPTH || (!bothObjects && !bothArrays)) {
    out.push({ path: path || "state", type: "changed", prev, next });
    return;
  }

  if (bothArrays) {
    const prevArr = prev as unknown[];
    const nextArr = next as unknown[];
    const len = Math.max(prevArr.length, nextArr.length);
    for (let i = 0; i < len && out.length < MAX_DIFF_ENTRIES; i++) {
      const childPath = `${path}[${i}]`;
      if (i >= prevArr.length) {
        out.push({ path: childPath, type: "added", next: nextArr[i] });
      } else if (i >= nextArr.length) {
        out.push({ path: childPath, type: "removed", prev: prevArr[i] });
      } else {
        collectDiff(prevArr[i], nextArr[i], childPath, out, depth + 1);
      }
    }
    return;
  }

  const p = prev as Record<string, unknown>;
  const n = next as Record<string, unknown>;
  const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
  for (const key of keys) {
    if (out.length >= MAX_DIFF_ENTRIES) return;
    const childPath = path ? `${path}.${key}` : key;
    if (!(key in p)) {
      out.push({ path: childPath, type: "added", next: n[key] });
    } else if (!(key in n)) {
      out.push({ path: childPath, type: "removed", prev: p[key] });
    } else {
      collectDiff(p[key], n[key], childPath, out, depth + 1);
    }
  }
}

function diffState(prev: unknown, next: unknown): DiffEntry[] {
  const result: DiffEntry[] = [];
  collectDiff(prev, next, "", result, 0);
  return result;
}

export const createSentinelReduxMiddleware = (
  options: SentinelReduxMiddlewareOptions = {},
): SentinelReduxMiddleware => {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const records: ActionRecord[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(l => l());

  return {
    middleware: store => next => action => {
      const prev = store.getState();
      const result = next(action);
      const nextState = store.getState();
      const a = action as { type: string };

      records.unshift({
        id: ++_id,
        action: a,
        diff: diffState(prev, nextState),
        timestamp: Date.now(),
      });

      if (records.length > maxRecords) records.pop();
      notify();
      return result;
    },

    _getRecords() { return records; },

    _getSerializableRecords() {
      return records.map(r =>
        safeClone(r) ?? {
          ...r,
          action: { type: r.action.type },
          diff: r.diff.map(e => safeClone(e) ?? { path: e.path, type: e.type }),
        },
      );
    },

    _subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    _clear() {
      records.length = 0;
      notify();
    },
  };
};
