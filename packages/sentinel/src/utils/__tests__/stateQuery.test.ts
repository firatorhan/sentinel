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
