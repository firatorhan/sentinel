export const getPreview = (value: unknown): string => {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `"${value.length > 20 ? value.slice(0, 20) + "…" : value}"`;
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === "object") {
    const n = Object.keys(value).length;
    return `{ ${n} key${n !== 1 ? "s" : ""} }`;
  }
  return JSON.stringify(value) ?? "";
};

export const filterState = (value: unknown, query: string): unknown => {
  if (!query) return value;
  const q = query.toLowerCase();

  if (value === null || typeof value !== "object") {
    return String(value).toLowerCase().includes(q) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => filterState(item, query))
      .filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k.toLowerCase().includes(q)) {
      result[k] = v;
    } else {
      const child = filterState(v, query);
      if (child !== undefined) result[k] = child;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

export const filteredEntries = (
  entries: [string, unknown][],
  search: string,
): { key: string; displayValue: unknown }[] => {
  if (!search) return entries.map(([key, value]) => ({ key, displayValue: value }));
  return entries
    .map(([key, value]) => {
      const keyMatches = key.toLowerCase().includes(search.toLowerCase());
      const filteredValue = filterState(value, search);
      if (!keyMatches && filteredValue === undefined) return null;
      return { key, displayValue: keyMatches ? value : filteredValue };
    })
    .filter(Boolean) as { key: string; displayValue: unknown }[];
};
