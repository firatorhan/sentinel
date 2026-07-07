### Task 1: vitest altyapısı + `searchStateByQuery`

**Files:**
- Create: `packages/sentinel/vitest.config.ts`
- Create: `packages/sentinel/src/utils/stateQuery.ts`
- Test: `packages/sentinel/src/utils/__tests__/stateQuery.test.ts`
- Modify: `packages/sentinel/package.json` (devDeps + test script)

**Interfaces:**
- Consumes: `normalize` (`./apiCalls`), `getPreview` (`./stateSearch`) — mevcut.
- Produces: `searchStateByQuery(state: unknown, query: string): StateQueryMatch[]` ve `type StateQueryMatch = { path: string; preview: string; matchType: "path" | "value"; norm?: string }`. Task 2 ve Task 8 bunları kullanır.

- [ ] **Step 1: vitest kur**

```bash
cd /Users/orhanfhb/Projects/sentinel/packages/sentinel
npm install -D vitest jsdom
```

`package.json` scripts'e ekle: `"test": "vitest run"`.

- [ ] **Step 2: vitest.config.ts oluştur**

```ts
// packages/sentinel/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Failing testleri yaz**

```ts
// packages/sentinel/src/utils/__tests__/stateQuery.test.ts
import { describe, it, expect } from "vitest";
import { searchStateByQuery } from "../stateQuery";

const state = {
  productState: {
    product: {
      name: "Kablosuz Kulaklık",
      prices: [{ value: 1299, currency: "TRY" }],
      inStock: true,
    },
  },
  searchState: { keyword: "kulaklik" },
};

describe("searchStateByQuery", () => {
  it("matches leaf values by normalized content", () => {
    const results = searchStateByQuery(state, "1299");
    expect(results).toContainEqual({
      path: "productState.product.prices[0].value",
      preview: "1299",
      matchType: "value",
      norm: "1299",
    });
  });

  it("matches paths whose segment contains the query", () => {
    const results = searchStateByQuery(state, "price");
    const paths = results.map((r) => r.path);
    expect(paths).toContain("productState.product.prices[0].value");
    expect(results.find((r) => r.path.includes("prices"))?.matchType).toBe("path");
  });

  it("includes path-matched non-string leaves (booleans)", () => {
    const results = searchStateByQuery(state, "stock");
    expect(results.map((r) => r.path)).toContain("productState.product.inStock");
  });

  it("sorts value matches before path matches", () => {
    // "kulaklik" değeri searchState.keyword'de value olarak, product.name'de yok (İ/i farkı)
    const results = searchStateByQuery(state, "kulaklik");
    expect(results[0].matchType).toBe("value");
  });

  it("returns empty for short queries and empty state", () => {
    expect(searchStateByQuery(state, "ab")).toEqual([]);
    expect(searchStateByQuery(null, "price")).toEqual([]);
  });

  it("caps result count", () => {
    const wide = { list: Array.from({ length: 100 }, (_, i) => ({ price: 1000 + i })) };
    expect(searchStateByQuery(wide, "price").length).toBeLessThanOrEqual(20);
  });
});
```

- [ ] **Step 4: Testin FAIL ettiğini doğrula**

Run: `cd packages/sentinel && npx vitest run src/utils/__tests__/stateQuery.test.ts`
Expected: FAIL — `Cannot find module '../stateQuery'`

- [ ] **Step 5: Implementasyonu yaz**

```ts
// packages/sentinel/src/utils/stateQuery.ts
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
```

- [ ] **Step 6: Testlerin PASS ettiğini doğrula**

Run: `cd packages/sentinel && npx vitest run src/utils/__tests__/stateQuery.test.ts`
Expected: PASS (6 test)

- [ ] **Step 7: Commit**

```bash
cd /Users/orhanfhb/Projects/sentinel
git add packages/sentinel/vitest.config.ts packages/sentinel/src/utils/stateQuery.ts packages/sentinel/src/utils/__tests__/stateQuery.test.ts packages/sentinel/package.json packages/sentinel/package-lock.json package-lock.json
git commit -m "feat: query-based state search for MCP lineage"
```

---

