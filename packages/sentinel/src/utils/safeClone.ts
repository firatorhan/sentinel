// JSON round-trip clone; undefined when the value is not serializable
export function safeClone<T = unknown>(val: T): T | undefined {
  if (val === null || val === undefined) return val;
  try {
    return JSON.parse(JSON.stringify(val)) as T;
  } catch {
    return undefined;
  }
}
