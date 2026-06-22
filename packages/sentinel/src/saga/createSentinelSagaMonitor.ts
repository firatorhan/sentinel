const MAX_RECORDS = 100;

export type EffectStatus = "pending" | "resolved" | "rejected" | "cancelled";

export type EffectRecord = {
  id: number;
  parentId: number;
  fnName: string;
  args: unknown[];
  status: EffectStatus;
  result?: unknown;
  error?: unknown;
  startedAt: number;
  duration?: number;
};

export type SentinelSagaMonitor = {
  effectTriggered(options: { effectId: number; parentEffectId: number; label: string; effect: unknown }): void;
  effectResolved(effectId: number, result: unknown): void;
  effectRejected(effectId: number, error: unknown): void;
  effectCancelled(effectId: number): void;
  _subscribe(listener: () => void): () => void;
  _getEffects(): EffectRecord[];
  _getSerializableEffects(): EffectRecord[];
  _clear(): void;
};

const safeClone = (val: unknown): unknown => {
  if (val === undefined || val === null) return val;
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return null;
  }
};

const safeResult = (result: unknown): unknown => {
  if (result === undefined || result === null) return result;
  if (
    typeof result === "object" &&
    "data" in (result as Record<string, unknown>) &&
    "status" in (result as Record<string, unknown>)
  ) {
    // Axios-like response — keep data + safe config fields (skip functions)
    const r = result as Record<string, unknown>;
    const cfg = r.config as Record<string, unknown> | undefined;
    return safeClone({
      status: r.status,
      statusText: r.statusText,
      data: r.data,
      config: cfg
        ? {
            url: cfg.url,
            method: cfg.method,
            baseURL: cfg.baseURL,
            headers: cfg.headers,
            data: cfg.data,
            timeout: cfg.timeout,
          }
        : undefined,
    });
  }
  return safeClone(result);
};

export const createSentinelSagaMonitor = (): SentinelSagaMonitor => {
  const effects = new Map<number, EffectRecord>();
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((l) => l());

  const trim = () => {
    if (effects.size > MAX_RECORDS) {
      effects.delete(effects.keys().next().value!);
    }
  };

  return {
    effectTriggered({ effectId, parentEffectId, effect }) {
      const e = effect as any;

      // redux-saga v1.x+: { type: "CALL", payload: { fn, args } }
      // redux-saga v0.x:  { CALL: { fn, args } }
      let fnName: string | undefined;
      let args: unknown[] | undefined;

      if (e?.type === "CALL") {
        fnName = e.payload?.fn?.name;
        args = e.payload?.args;
      } else if (e?.CALL) {
        fnName = e.CALL?.fn?.name;
        args = e.CALL?.args;
      } else {
        return;
      }

      effects.set(effectId, {
        id: effectId,
        parentId: parentEffectId,
        fnName: fnName || "anonymous",
        args: args ?? [],
        status: "pending",
        startedAt: Date.now(),
      });
      trim();
      notify();
    },

    effectResolved(effectId, result) {
      const record = effects.get(effectId);
      if (!record) return;
      effects.set(effectId, {
        ...record,
        status: "resolved",
        result,
        duration: Date.now() - record.startedAt,
      });
      notify();
    },

    effectRejected(effectId, error) {
      const record = effects.get(effectId);
      if (!record) return;
      effects.set(effectId, {
        ...record,
        status: "rejected",
        error,
        duration: Date.now() - record.startedAt,
      });
      notify();
    },

    effectCancelled(effectId) {
      const record = effects.get(effectId);
      if (!record) return;
      effects.set(effectId, {
        ...record,
        status: "cancelled",
        duration: Date.now() - record.startedAt,
      });
      notify();
    },

    _subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    _getEffects() {
      return Array.from(effects.values()).reverse();
    },

    _getSerializableEffects() {
      return Array.from(effects.values())
        .reverse()
        .map((e) => ({
          id: e.id,
          parentId: e.parentId,
          fnName: e.fnName,
          status: e.status,
          startedAt: e.startedAt,
          duration: e.duration,
          args: (safeClone(e.args) ?? []) as unknown[],
          result: safeResult(e.result),
          error: e.error !== undefined
            ? (safeClone(e.error instanceof Error ? e.error.message : e.error) ?? String(e.error))
            : undefined,
        }));
    },

    _clear() {
      effects.clear();
      notify();
    },
  };
};
