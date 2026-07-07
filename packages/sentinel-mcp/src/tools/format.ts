export const MAX_JSON_CHARS = 4000;

export const truncateJson = (value: unknown, maxChars = MAX_JSON_CHARS): string => {
  const json = JSON.stringify(value, null, 2) ?? "undefined";
  if (json.length <= maxChars) return json;
  return `${json.slice(0, maxChars)}\n… (${json.length - maxChars} chars truncated)`;
};

export const formatTime = (timestamp: number): string => new Date(timestamp).toISOString();

// "a.b[0].c" → state içindeki değer
export const getAtPath = (root: unknown, path: string): unknown => {
  const segments = path
    .split(/[.[]/)
    .map((s) => s.replace(/\]$/, ""))
    .filter(Boolean);
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};
