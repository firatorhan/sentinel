import { buildLineageFromQuery, type Snapshot } from "@sentinel-core/sentinel/core";
import { formatTime } from "./format";

export const formatLineage = (snapshot: Snapshot, query: string): string => {
  const entries = buildLineageFromQuery({
    query,
    state: snapshot.state,
    serverState: snapshot.serverState,
    clientActions: snapshot.clientActions,
    serverActions: snapshot.serverActions,
    clientEffects: snapshot.clientEffects,
    serverEffects: snapshot.serverEffects,
  });
  if (entries.length === 0) {
    return `No match for "${query}" in state, actions or API calls of ${snapshot.url}. Try get_state with a query to explore, or a longer/different term.`;
  }
  return entries
    .map((entry) => {
      const lines = [`${entry.statePath} = ${entry.preview} (${entry.matchType} match)`];
      if (entry.actionType) {
        lines.push(
          `  ← ${entry.actionType} (${entry.actionOrigin}, ${formatTime(entry.actionTimestamp ?? 0)})`,
        );
      }
      if (entry.api) {
        const status = entry.api.status !== undefined ? `${entry.api.status}` : "?";
        const duration = entry.api.duration !== undefined ? `, ${entry.api.duration}ms` : "";
        lines.push(`  ← ${entry.api.method} ${entry.api.url} (${status}${duration}, ${entry.api.origin})`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
};
