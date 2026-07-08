import { describe, it, expect } from "vitest";
import { findComponentsByName, summarizeComponents } from "../componentQuery";
import type { ComponentRecord } from "../../bridge/protocol";

const rec = (id: string, name: string, props: Record<string, unknown>): ComponentRecord => ({
  id,
  name,
  renderCount: 1,
  props,
  updatedAt: 0,
});

const components: ComponentRecord[] = [
  rec("a", "ProductCard", { product: { id: 1, name: "Ayakkabı" } }),
  rec("b", "ProductCard", { product: { id: 2, name: "Şapka" } }),
  rec("c", "ProductList", { items: 2 }),
];

describe("findComponentsByName", () => {
  it("returns every instance of a matching name", () => {
    const matches = findComponentsByName(components, "ProductCard");
    expect(matches.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("matches case-insensitively on a substring", () => {
    expect(findComponentsByName(components, "list").map((c) => c.id)).toEqual(["c"]);
    expect(findComponentsByName(components, "PRODUCT")).toHaveLength(3);
  });

  it("returns empty for no match", () => {
    expect(findComponentsByName(components, "Nope")).toEqual([]);
  });
});

describe("summarizeComponents", () => {
  it("collapses instances into name → count, sorted by name", () => {
    expect(summarizeComponents(components)).toEqual([
      { name: "ProductCard", count: 2 },
      { name: "ProductList", count: 1 },
    ]);
  });

  it("handles an empty list", () => {
    expect(summarizeComponents([])).toEqual([]);
  });
});
