import { describe, it, expect } from "vitest";
import { buildLineageFromQuery } from "../lineage";
import type { EffectRecord } from "../../saga/createSentinelSagaMonitor";
import type { ActionRecord } from "../../redux/createSentinelReduxMiddleware";

// Saga ağacı: FORK loadProduct (1) → CALL getProduct (2) → PUT GET_PRODUCT_FULFILLED (3)
const effects: EffectRecord[] = [
  { id: 1, parentId: 0, type: "FORK", fnName: "loadProduct", args: [], status: "resolved", startedAt: 50 },
  {
    id: 2, parentId: 1, type: "CALL", fnName: "getProduct", args: [], status: "resolved", startedAt: 100, duration: 340,
    result: {
      status: 200, statusText: "OK",
      data: { prices: [{ value: 1299 }] },
      config: { url: "/productDetail", method: "get", baseURL: "https://api.example.com" },
    },
  },
  {
    id: 3, parentId: 1, type: "PUT", fnName: "GET_PRODUCT_FULFILLED",
    args: [{ type: "GET_PRODUCT_FULFILLED", payload: { prices: [{ value: 1299 }] } }],
    status: "resolved", startedAt: 200,
  },
];

const actions: ActionRecord[] = [
  {
    id: 1,
    action: { type: "GET_PRODUCT_FULFILLED", payload: { prices: [{ value: 1299 }] } },
    diff: [{ path: "productState.product", type: "changed" }],
    timestamp: 200,
  },
];

const state = { productState: { product: { prices: [{ value: 1299 }] } } };

describe("buildLineageFromQuery", () => {
  it("chains state path ← action ← API call for a path query", () => {
    const entries = buildLineageFromQuery({
      query: "price",
      state,
      clientActions: actions,
      clientEffects: effects,
    });
    const entry = entries.find((e) => e.statePath === "productState.product.prices[0].value");
    expect(entry).toBeDefined();
    expect(entry!.actionType).toBe("GET_PRODUCT_FULFILLED");
    expect(entry!.actionOrigin).toBe("client");
    expect(entry!.api).toMatchObject({
      method: "GET",
      url: "https://api.example.com/productDetail",
      origin: "client",
      status: 200,
      duration: 340,
    });
  });

  it("chains for a value query too", () => {
    const entries = buildLineageFromQuery({
      query: "1299",
      state,
      clientActions: actions,
      clientEffects: effects,
    });
    expect(entries[0].matchType).toBe("value");
    expect(entries[0].actionType).toBe("GET_PRODUCT_FULFILLED");
  });

  it("uses server data when client state is absent", () => {
    const entries = buildLineageFromQuery({
      query: "price",
      serverState: state,
      serverActions: actions,
      serverEffects: effects,
    });
    expect(entries[0].actionOrigin).toBe("server");
    expect(entries[0].api?.origin).toBe("server");
  });

  it("returns state-only entries when no action matches", () => {
    const entries = buildLineageFromQuery({ query: "price", state });
    expect(entries[0].statePath).toBe("productState.product.prices[0].value");
    expect(entries[0].actionType).toBeUndefined();
  });

  it("returns empty when nothing matches", () => {
    expect(buildLineageFromQuery({ query: "yokboyleveri", state })).toEqual([]);
  });
});
