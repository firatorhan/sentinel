import { safeClone } from "../utils/safeClone";

const DEFAULT_MAX_RECORDS = 100;

export type SentinelSagaMonitorOptions = {
  maxRecords?: number;
};

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

const trimConfig = (cfg: Record<string, unknown> | undefined) =>
  cfg
    ? {
        url: cfg.url,
        method: cfg.method,
        baseURL: cfg.baseURL,
        headers: cfg.headers,
        data: cfg.data,
        timeout: cfg.timeout,
      }
    : undefined;

// Axios responses and errors both drag a circular `request` object along, so
// they must be trimmed before the JSON round-trip — otherwise safeClone drops
// the whole value.
const trimAxiosValue = (val: unknown): unknown => {
  if (val === null || typeof val !== "object") return val;
  const r = val as Record<string, unknown>;
  if ("data" in r && "status" in r) {
    // Axios-like response — keep data + safe config fields (skip functions)
    return {
      status: r.status,
      statusText: r.statusText,
      data: r.data,
      config: trimConfig(r.config as Record<string, unknown> | undefined),
    };
  }
  if ("config" in r && ("message" in r || "response" in r)) {
    // Axios-like error — keep the message, config and trimmed response
    const response = r.response as Record<string, unknown> | undefined;
    return {
      message: r.message,
      config: trimConfig(r.config as Record<string, unknown> | undefined),
      response:
        response && typeof response === "object"
          ? { status: response.status, statusText: response.statusText, data: response.data }
          : undefined,
    };
  }
  return val;
};

const safeResult = (result: unknown): unknown => {
  if (result === undefined || result === null) return result;
  if (Array.isArray(result)) {
    // Batched result (e.g. Voltran getFragments): entries are either bare
    // axios values or settle contexts holding one under `result`. Clone per
    // entry so one unserializable item can't wipe out the batch, and keep
    // indexes aligned with the effect args.
    return result.map((entry) => {
      if (entry !== null && typeof entry === "object" && "result" in (entry as Record<string, unknown>)) {
        const e = entry as Record<string, unknown>;
        return safeClone({ ...e, result: trimAxiosValue(e.result) });
      }
      return safeClone(trimAxiosValue(entry));
    });
  }
  return safeClone(trimAxiosValue(result));
};

export const createSentinelSagaMonitor = (
  options: SentinelSagaMonitorOptions = {},
): SentinelSagaMonitor => {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const effects = new Map<number, EffectRecord>();
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((l) => l());

  const trim = () => {
    if (effects.size > maxRecords) {
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
