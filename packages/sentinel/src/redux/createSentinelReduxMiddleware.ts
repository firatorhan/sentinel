const MAX_RECORDS = 50;
let _id = 0;

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

function diffTopLevel(prev: unknown, next: unknown): DiffEntry[] {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === "object" && !Array.isArray(v);

  if (!isObj(prev) || !isObj(next)) {
    return prev !== next ? [{ path: "state", type: "changed", prev, next }] : [];
  }

  const result: DiffEntry[] = [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of keys) {
    const inPrev = key in prev;
    const inNext = key in next;
    if (!inPrev) {
      result.push({ path: key, type: "added", next: next[key] });
    } else if (!inNext) {
      result.push({ path: key, type: "removed", prev: prev[key] });
    } else if (prev[key] !== next[key]) {
      result.push({ path: key, type: "changed", prev: prev[key], next: next[key] });
    }
  }

  return result;
}

export const createSentinelReduxMiddleware = (): SentinelReduxMiddleware => {
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
        diff: diffTopLevel(prev, nextState),
        timestamp: Date.now(),
      });

      if (records.length > MAX_RECORDS) records.pop();
      notify();
      return result;
    },

    _getRecords() { return records; },

    _getSerializableRecords() {
      return records.map(r => {
        try {
          return JSON.parse(JSON.stringify(r)) as ActionRecord;
        } catch {
          return {
            ...r,
            action: { type: r.action.type },
            diff: r.diff.map(e => {
              try { return JSON.parse(JSON.stringify(e)) as typeof e; }
              catch { return { path: e.path, type: e.type } as typeof e; }
            }),
          };
        }
      });
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
