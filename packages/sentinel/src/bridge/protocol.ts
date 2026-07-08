import type { EffectRecord } from "../saga/createSentinelSagaMonitor";
import type { ActionRecord } from "../redux/createSentinelReduxMiddleware";

// One captured React component instance. `props` is already run through
// safeSerialize at the wrapper, so it is wire-safe.
export type ComponentRecord = {
  id: string;
  name: string;
  sourceFile?: string;
  renderCount: number;
  props: Record<string, unknown>;
  updatedAt: number;
};

export type SnapshotData = {
  state: unknown;
  serverState?: unknown;
  clientEffects: EffectRecord[];
  serverEffects?: EffectRecord[];
  clientActions: ActionRecord[];
  serverActions?: ActionRecord[];
  components?: ComponentRecord[];
};

export type Snapshot = SnapshotData & {
  tabId: string;
  url: string;
  title: string;
  timestamp: number;
};

export type BrowserMessage =
  | { kind: "register"; tabId: string; url: string; title: string }
  | { kind: "active"; tabId: string }
  | { kind: "snapshot"; requestId: string; snapshot: Snapshot };

export type ServerMessage = { kind: "snapshot-request"; requestId: string };

export const DEFAULT_MCP_URL = "ws://localhost:8790";
