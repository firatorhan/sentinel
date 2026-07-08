import { findComponentsByName, summarizeComponents, type Snapshot } from "@sentinel-core/sentinel/core";

// Keep the full prop structure — every key, every nesting level — and only
// trim individual oversized *values* (raw HTML blobs, base64, long
// descriptions). The structure is what's useful for debugging; a single
// giant string value is the only thing that bloats the output. Long strings
// become a preview + char count so nothing meaningful is silently dropped.
const MAX_STRING = 300;
const MAX_TOTAL = 16000;

const abbreviate = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value.length > MAX_STRING
      ? `«String ${value.length} chars: ${value.slice(0, 100)}…»`
      : value;
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(abbreviate);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) out[k] = abbreviate(obj[k]);
  return out;
};

// One line per top-level prop; each value keeps its full structure with only
// oversized strings trimmed. MAX_TOTAL is a final backstop against a prop set
// that is large even after string trimming.
const formatProps = (props: Record<string, unknown>): string => {
  const entries = Object.entries(props);
  if (entries.length === 0) return "{}";
  const body = entries
    .map(([key, value]) => `  ${key}: ${JSON.stringify(abbreviate(value))}`)
    .join("\n");
  const out = `{\n${body}\n}`;
  if (out.length <= MAX_TOTAL) return out;
  return `${out.slice(0, MAX_TOTAL)}\n… (${out.length - MAX_TOTAL} chars truncated)`;
};

export const formatComponents = (snapshot: Snapshot, opts: { name?: string }): string => {
  const components = snapshot.components ?? [];
  if (components.length === 0) {
    return `No components captured on ${snapshot.url}. Ensure the sentinel plugin wrapped the app and it rendered client-side.`;
  }

  if (!opts.name) {
    const summary = summarizeComponents(components);
    return [
      `${components.length} component instances captured. Call get_component_props with a name to see props.`,
      "",
      ...summary.map((s) => `${s.name}  ×${s.count}`),
    ].join("\n");
  }

  const matches = findComponentsByName(components, opts.name);
  if (matches.length === 0) {
    return `No component matches "${opts.name}". Call get_component_props without a name to list captured components.`;
  }

  const multiple = matches.length > 1;
  return matches
    .map((c, i) => {
      const label = multiple ? `${c.name} #${i + 1}` : c.name;
      const file = c.sourceFile ? `\n${c.sourceFile}` : "";
      return `${label} (renderCount ${c.renderCount})${file}\nprops =\n${formatProps(c.props)}`;
    })
    .join("\n\n");
};
