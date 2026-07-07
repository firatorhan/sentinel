import { normalize } from "./apiCalls";
import { getPreview } from "./stateSearch";

export type StateQueryMatch = {
  path: string;
  preview: string;
  matchType: "path" | "value";
  // value match'lerde eşleşen değerin normalize hali; lineage'ta payload
  // kanıtı olarak kullanılır.
  norm?: string;
};

const MAX_STATE_NODES = 60000;
const MAX_STATE_DEPTH = 10;
const MAX_MATCHES = 20;
const MIN_QUERY_LENGTH = 3;

// Sorguyu state'te iki yönlü arar: path segmenti sorguyu içeren yapraklar
// ("price" → ...prices[0].value) ve normalize değeri sorguyu içeren yapraklar
// ("1299" → o değeri taşıyan path'ler). searchState'in (lineage.ts) sorgu
// tabanlı varyantı — o hedef-değer kümesiyle çalışır, bu serbest metinle.
export const searchStateByQuery = (state: unknown, query: string): StateQueryMatch[] => {
  const results: StateQueryMatch[] = [];
  if (state === null || state === undefined || query.length < MIN_QUERY_LENGTH) return results;
  const q = query.toLowerCase();
  let visited = 0;

  const walk = (val: unknown, path: string, depth: number, pathMatched: boolean): void => {
    if (
      results.length >= MAX_MATCHES ||
      visited++ > MAX_STATE_NODES ||
      depth > MAX_STATE_DEPTH ||
      val === null ||
      val === undefined
    ) {
      return;
    }
    const norm = normalize(val);
    if (norm !== undefined) {
      if (norm.includes(q)) {
        results.push({ path, preview: getPreview(val), matchType: "value", norm });
      } else if (pathMatched) {
        results.push({ path, preview: getPreview(val), matchType: "path" });
      }
      return;
    }
    if (typeof val !== "object") {
      // normalize'ın elemediği primitifler (boolean, kısa string/sayı):
      // path eşleşmesi varsa yine de göster.
      if (pathMatched) results.push({ path, preview: getPreview(val), matchType: "path" });
      return;
    }
    if (Array.isArray(val)) {
      val.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1, pathMatched));
      return;
    }
    for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      walk(v, childPath, depth + 1, pathMatched || key.toLowerCase().includes(q));
    }
  };

  walk(state, "", 0, false);
  // Değer kanıtı path benzerliğinden güçlüdür.
  return results.sort(
    (a, b) => Number(b.matchType === "value") - Number(a.matchType === "value"),
  );
};
