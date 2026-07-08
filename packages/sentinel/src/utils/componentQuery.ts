import type { ComponentRecord } from "../bridge/protocol";

// Case-insensitive substring match on component name. Returns every matching
// instance — multiple instances of the same component are disambiguated by
// their props (and renderCount) on the read side.
export const findComponentsByName = (
  components: ComponentRecord[],
  name: string,
): ComponentRecord[] => {
  const q = name.toLowerCase();
  return components.filter((c) => c.name.toLowerCase().includes(q));
};

export type ComponentSummary = { name: string; count: number };

// Collapse the flat instance list into name → instance count, sorted by name.
export const summarizeComponents = (
  components: ComponentRecord[],
): ComponentSummary[] => {
  const counts = new Map<string, number>();
  for (const c of components) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
};
