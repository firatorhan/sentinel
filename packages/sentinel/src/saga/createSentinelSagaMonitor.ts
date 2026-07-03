const MAX_RECORDS = 100;

export type EffectStatus = "pending" | "resolved" | "rejected" | "cancelled";
export type EffectType = "CALL" | "FORK" | "SPAWN" | "TAKE" | "PUT" | "unknown";

export type EffectRecord = {
  id: number;
  parentId: number;
  type: EffectType;
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

      let effectType: EffectType = "unknown";
      let fnName: string | undefined;
      let args: unknown[] | undefined;

      const fnInfo = (payload: any) => ({
        name: payload?.fn?.name || payload?.fn?.displayName || "anonymous",
        args: payload?.args ?? [],
      });

      // redux-saga v1.x+
      if (e?.type === "CALL") {
        effectType = "CALL";
        const f = fnInfo(e.payload); fnName = f.name; args = f.args;
      } else if (e?.type === "FORK") {
        effectType = e.payload?.detached ? "SPAWN" : "FORK";
        const f = fnInfo(e.payload); fnName = f.name; args = f.args;
      } else if (e?.type === "TAKE") {
        effectType = "TAKE";
        fnName = String(e.payload?.pattern ?? "*");
        args = [];
      } else if (e?.type === "PUT") {
        effectType = "PUT";
        fnName = e.payload?.action?.type ?? "unknown";
        args = e.payload?.action ? [e.payload.action] : [];
      }
      // redux-saga v0.x
      else if (e?.CALL) {
        effectType = "CALL";
        fnName = e.CALL?.fn?.name || "anonymous"; args = e.CALL?.args ?? [];
      } else if (e?.FORK) {
        effectType = "FORK";
        fnName = e.FORK?.fn?.name || "anonymous"; args = e.FORK?.args ?? [];
      } else if (e?.TAKE) {
        effectType = "TAKE";
        fnName = String(e.TAKE?.pattern ?? "*"); args = [];
      } else if (e?.PUT) {
        effectType = "PUT";
        fnName = e.PUT?.action?.type ?? "unknown";
        args = e.PUT?.action ? [e.PUT.action] : [];
      } else {
        return;
      }

      effects.set(effectId, {
        id: effectId,
        parentId: parentEffectId,
        type: effectType,
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
          type: e.type,
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
