import type { Snapshot } from "@sentinel-core/sentinel/core";
import { formatTime } from "./format";

const DEFAULT_LIMIT = 20;

export const formatActionLog = (snapshot: Snapshot, limit = DEFAULT_LIMIT): string => {
  const actions = [
    ...(snapshot.serverActions ?? []).map((record) => ({ record, origin: "server" as const })),
    ...snapshot.clientActions.map((record) => ({ record, origin: "client" as const })),
  ]
    .sort((a, b) => b.record.timestamp - a.record.timestamp)
    .slice(0, limit);
  if (actions.length === 0) return `No actions captured on ${snapshot.url}.`;
  return actions
    .map(({ record, origin }) => {
      const diffs = record.diff.map((d) => `    ${d.type}: ${d.path}`).join("\n");
      return `${record.action.type} (${origin}, ${formatTime(record.timestamp)})${diffs ? `\n${diffs}` : ""}`;
    })
    .join("\n");
};
