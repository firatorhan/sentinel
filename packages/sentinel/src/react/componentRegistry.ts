import { safeClone } from "../utils/safeClone";
import type { ComponentRecord } from "../bridge/protocol";

const DEFAULT_MAX_RECORDS = 500;

export type SentinelComponentRegistry = {
  upsert(record: ComponentRecord): void;
  unregister(id: string): void;
  _getRecords(): ComponentRecord[];
  _getSerializableRecords(): ComponentRecord[];
  _subscribe(listener: () => void): () => void;
  _clear(): void;
};

// Ambient store of mounted Sentinel wrappers, keyed by instance id. Written on
// every render (not on click) so MCP snapshots can read the live component set
// without any user interaction. Mirrors the saga-monitor / redux-middleware
// shape (_getRecords / _getSerializableRecords / _subscribe / _clear).
export const createSentinelComponentRegistry = (
  options: { maxRecords?: number } = {},
): SentinelComponentRegistry => {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const records = new Map<string, ComponentRecord>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  // Guard against a leak if unmount cleanup is ever missed: drop the least
  // recently updated record. Normal operation stays under the cap via unregister.
  const evictOldest = () => {
    let oldestId: string | undefined;
    let oldest = Infinity;
    for (const [id, rec] of records) {
      if (rec.updatedAt < oldest) {
        oldest = rec.updatedAt;
        oldestId = id;
      }
    }
    if (oldestId !== undefined) records.delete(oldestId);
  };

  return {
    upsert(record) {
      records.set(record.id, record);
      if (records.size > maxRecords) evictOldest();
      notify();
    },

    unregister(id) {
      if (records.delete(id)) notify();
    },

    _getRecords() {
      return [...records.values()];
    },

    // props are already safeSerialize'd at the wrapper; clone defensively so a
    // stray non-serializable value can never break the whole snapshot.
    _getSerializableRecords() {
      return [...records.values()].map(
        (r) =>
          safeClone(r) ?? {
            id: r.id,
            name: r.name,
            sourceFile: r.sourceFile,
            renderCount: r.renderCount,
            props: {},
            updatedAt: r.updatedAt,
          },
      );
    },

    _subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    _clear() {
      records.clear();
      notify();
    },
  };
};

export const noopComponentRegistry: SentinelComponentRegistry = {
  upsert: () => {},
  unregister: () => {},
  _getRecords: () => [],
  _getSerializableRecords: () => [],
  _subscribe: () => () => {},
  _clear: () => {},
};
