import { extractApiCalls, type ApiCall, type Snapshot } from "@sentinel-core/sentinel/core";
import { formatTime } from "./format";

export const allCalls = (snapshot: Snapshot): ApiCall[] => [
  ...extractApiCalls(snapshot.clientEffects, undefined, "client"),
  ...extractApiCalls(snapshot.serverEffects ?? [], undefined, "server"),
];

export const listApiCalls = (snapshot: Snapshot): string => {
  const calls = allCalls(snapshot).sort((a, b) => a.startedAt - b.startedAt);
  if (calls.length === 0) return `No API calls captured on ${snapshot.url}.`;
  return calls
    .map((call) => {
      const status = call.responseStatus ?? (call.errorMessage ? "ERR" : "?");
      const duration = call.duration !== undefined ? `${call.duration}ms` : "-";
      const error = call.errorMessage ? ` error="${call.errorMessage}"` : "";
      return `[${call.origin}] ${call.method} ${call.url} → ${status} (${duration}, ${formatTime(call.startedAt)})${error}`;
    })
    .join("\n");
};

const normalizeUrl = (url: string): string => url.split("#")[0];

export const findDuplicates = (snapshot: Snapshot): string => {
  const calls = allCalls(snapshot);
  const groups = new Map<string, ApiCall[]>();
  for (const call of calls) {
    const key = `${call.method} ${normalizeUrl(call.url)}`;
    const group = groups.get(key) ?? [];
    group.push(call);
    groups.set(key, group);
  }
  const duplicates = Array.from(groups.entries()).filter(([, group]) => group.length > 1);
  if (duplicates.length === 0) return `No duplicate API calls on ${snapshot.url}.`;
  return duplicates
    .map(([key, group]) => {
      const clientCount = group.filter((c) => c.origin === "client").length;
      const serverCount = group.filter((c) => c.origin === "server").length;
      const doubleFetch = clientCount > 0 && serverCount > 0 ? " ⚠ double-fetch (server + client)" : "";
      return `${group.length}x ${key} (client: ${clientCount}, server: ${serverCount})${doubleFetch}`;
    })
    .join("\n");
};
