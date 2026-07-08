// packages/sentinel/src/core.ts
// Headless entry: React ve CSS içermez — Node tüketicileri (sentinel-mcp) için.
export {
  buildLineage,
  buildLineageFromQuery,
} from "./utils/lineage";
export type {
  LineageEntry,
  LineageInput,
  QueryLineageEntry,
  QueryLineageInput,
} from "./utils/lineage";
export { searchStateByQuery } from "./utils/stateQuery";
export type { StateQueryMatch } from "./utils/stateQuery";
export { findComponentsByName, summarizeComponents } from "./utils/componentQuery";
export type { ComponentSummary } from "./utils/componentQuery";
export { extractApiCalls, correlateProps, sortApiCalls, buildCurl } from "./utils/apiCalls";
export type { ApiCall, PropMatch } from "./utils/apiCalls";
export type {
  EffectRecord,
  EffectStatus,
  EffectType,
  SentinelSagaMonitor,
} from "./saga/createSentinelSagaMonitor";
export type {
  ActionRecord,
  DiffEntry,
  DiffType,
  SentinelReduxMiddleware,
} from "./redux/createSentinelReduxMiddleware";
export { DEFAULT_MCP_URL } from "./bridge/protocol";
export type { Snapshot, SnapshotData, BrowserMessage, ServerMessage, ComponentRecord } from "./bridge/protocol";
