export function safeSerialize(value: unknown, depth = 0, seen = new WeakSet()): unknown {
  if (depth > 6) return "[Max Depth]";

  if (value === null) return null;
  if (typeof value === "function") return "[Function]";
  if (typeof value !== "object") return value;

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  // React element veya context objelerini filtrele
  if ("$$typeof" in (value as object)) return "[React Element]";
  if ("_context" in (value as object)) return "[React Context]";
  if ("Provider" in (value as object) && "Consumer" in (value as object)) return "[React Context]";

  if (Array.isArray(value)) {
    return value.map((item) => safeSerialize(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    // React internal key'leri atla
    if (key.startsWith("__react") || key.startsWith("_react") || key === "_owner") continue;
    result[key] = safeSerialize(val, depth + 1, seen);
  }
  return result;
}
