import { searchStateByQuery, type Snapshot } from "@sentinel-core/sentinel/core";
import { getAtPath, truncateJson } from "./format";

const previewSize = (value: unknown): string => {
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (value !== null && typeof value === "object") return `object{${Object.keys(value).length} keys}`;
  return JSON.stringify(value) ?? String(value);
};

export const formatState = (
  snapshot: Snapshot,
  opts: { path?: string; query?: string },
): string => {
  const state = snapshot.state ?? snapshot.serverState;
  if (state === null || state === undefined) return `No state captured on ${snapshot.url}.`;

  if (opts.path) {
    const value = getAtPath(state, opts.path);
    if (value === undefined) return `Path "${opts.path}" not found in state. Use get_state with a query to search.`;
    return `${opts.path} =\n${truncateJson(value)}`;
  }

  if (opts.query) {
    const matches = searchStateByQuery(state, opts.query);
    if (matches.length === 0) return `No state paths or values match "${opts.query}".`;
    return matches.map((m) => `${m.path} = ${m.preview} (${m.matchType})`).join("\n");
  }

  const root = state as Record<string, unknown>;
  return Object.entries(root)
    .map(([key, value]) => `${key}: ${previewSize(value)}`)
    .join("\n");
};
