# Sentinel MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sentinel'in runtime verisini (saga effects, API calls, action log, state) Claude Code'a MCP tool'ları olarak açmak — spec: [docs/mcp-design.md](../../mcp-design.md).

**Architecture:** Tarayıcıdaki `SentinelProvider` bir bridge modülüyle `localhost:8790`'daki `sentinel-mcp` process'ine WebSocket ile bağlanır. MCP tool çağrısı geldiğinde process aktif sekmeden taze snapshot **pull** eder ve sentinel'in deterministik fonksiyonlarını (`buildLineageFromQuery`, `extractApiCalls`…) snapshot üzerinde çalıştırır. Claude Code'a stdio ile bağlanır.

**Tech Stack:** TypeScript, vitest, `@modelcontextprotocol/sdk@^1.29.0` (v1 — v2 beta kullanma), `zod@^3.25`, `ws@^8`, tsup (mcp paketi build), vite (sentinel paketi build).

## Global Constraints

- `packages/sentinel` tarayıcı kodu: ES2019 target, React peer `>=16.8.0`, **yeni runtime dependency yok** (bridge native `WebSocket` kullanır).
- `packages/sentinel-mcp`: Node ≥ 18. **stdout MCP protokolüne aittir — tüm loglar `console.error` (stderr) ile yazılır.**
- MCP SDK importları `.js` uzantılı subpath'lerdir: `@modelcontextprotocol/sdk/server/mcp.js` gibi (v1.29.0'da doğrulandı).
- `inputSchema` **ZodRawShape**'tir (düz obje: `{ query: z.string() }`), `z.object(...)` değil.
- Sentinel repo commit formatı: `<type>: <kısa açıklama>` (JIRA yok). storefront-main commitleri: `<type>: <JIRA-KEY> <açıklama>`.
- Mevcut fonksiyonların davranışı değişmez: `buildLineage`, `findActionForStatePath`, `findApiCallForAction`, `extractApiCalls`, serileştiriciler ve kapasite sabitlerine (MAX_*) dokunulmaz.
- Snapshot boyut kapakları mevcut serileştiricilerden gelir (effects 100, actions 50, diff 60) — yeni kapak eklenmez.

---

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

### Task 2: `buildLineageFromQuery`

**Files:**
- Modify: `packages/sentinel/src/utils/lineage.ts` (dosya sonuna ekleme; mevcut fonksiyonlara dokunma)
- Test: `packages/sentinel/src/utils/__tests__/lineageQuery.test.ts`

**Interfaces:**
- Consumes: `searchStateByQuery` (Task 1); lineage.ts içindeki private `findActionForStatePath`, `findApiCallForAction`, `OriginAction`; `extractApiCalls`, `valuePathIndex` (`./apiCalls`).
- Produces:

```ts
export type QueryLineageEntry = {
  statePath: string;
  preview: string;
  matchType: "path" | "value";
  actionType?: string;
  actionTimestamp?: number;
  actionOrigin?: "client" | "server";
  api?: { method: string; url: string; origin: "client" | "server"; status?: number; duration?: number };
};
export type QueryLineageInput = {
  query: string;
  state?: unknown;
  serverState?: unknown;
  clientActions?: ActionRecord[];
  serverActions?: ActionRecord[];
  clientEffects?: EffectRecord[];
  serverEffects?: EffectRecord[];
};
export const buildLineageFromQuery: (input: QueryLineageInput) => QueryLineageEntry[];
```

- [ ] **Step 1: Failing testi yaz**

```ts
// packages/sentinel/src/utils/__tests__/lineageQuery.test.ts
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
```

- [ ] **Step 2: FAIL doğrula**

Run: `cd packages/sentinel && npx vitest run src/utils/__tests__/lineageQuery.test.ts`
Expected: FAIL — `buildLineageFromQuery is not a function` (export yok)

- [ ] **Step 3: Implementasyon — lineage.ts sonuna ekle**

```ts
// packages/sentinel/src/utils/lineage.ts — dosyanın SONUNA ekle.
// Import bloğuna ekle: import { searchStateByQuery } from "./stateQuery";
// apiCalls import satırına extractApiCalls zaten var; değişiklik gerekmez.

export type QueryLineageEntry = {
  statePath: string;
  preview: string;
  matchType: "path" | "value";
  actionType?: string;
  actionTimestamp?: number;
  actionOrigin?: "client" | "server";
  api?: {
    method: string;
    url: string;
    origin: ApiCall["origin"];
    status?: number;
    duration?: number;
  };
};

export type QueryLineageInput = {
  query: string;
  state?: unknown;
  serverState?: unknown;
  clientActions?: ActionRecord[];
  serverActions?: ActionRecord[];
  clientEffects?: EffectRecord[];
  serverEffects?: EffectRecord[];
};

// buildLineage'in ters yönlü varyantı: componentProps yerine serbest sorgudan
// başlar (MCP senaryosu — tıklanan komponent yok). Zincir aynı yapı taşlarıyla
// kurulur: state path (searchStateByQuery) → action (findActionForStatePath)
// → API call (findApiCallForAction).
export const buildLineageFromQuery = (input: QueryLineageInput): QueryLineageEntry[] => {
  const {
    query,
    state,
    serverState,
    clientActions = [],
    serverActions = [],
    clientEffects = [],
    serverEffects = [],
  } = input;

  const matches = searchStateByQuery(state ?? serverState, query);
  if (matches.length === 0) return [];

  const clientCalls = extractApiCalls(clientEffects, undefined, "client");
  const serverCalls = extractApiCalls(serverEffects, undefined, "server");

  const actions: OriginAction[] = [
    ...clientActions.map((record) => ({ record, origin: "client" as const })),
    ...serverActions.map((record) => ({ record, origin: "server" as const })),
  ].sort((a, b) => b.record.timestamp - a.record.timestamp);

  const payloadNormCache = new Map<ActionRecord, Set<string>>();
  const payloadNorms = (record: ActionRecord): Set<string> => {
    let norms = payloadNormCache.get(record);
    if (!norms) {
      norms = new Set(valuePathIndex(record.action).keys());
      payloadNormCache.set(record, norms);
    }
    return norms;
  };

  const entries: QueryLineageEntry[] = matches.map((match) => {
    const entry: QueryLineageEntry = {
      statePath: match.path,
      preview: match.preview,
      matchType: match.matchType,
    };

    const action = findActionForStatePath(match.path, actions, match.norm ?? "", payloadNorms);
    if (action) {
      entry.actionType = action.record.action?.type;
      entry.actionTimestamp = action.record.timestamp;
      entry.actionOrigin = action.origin;

      if (entry.actionType) {
        const originEffects = action.origin === "client" ? clientEffects : serverEffects;
        const originCalls = action.origin === "client" ? clientCalls : serverCalls;
        const call = findApiCallForAction(entry.actionType, originEffects, originCalls);
        if (call) {
          entry.api = {
            method: call.method,
            url: call.url,
            origin: call.origin,
            status: call.responseStatus,
            duration: call.duration,
          };
        }
      }
    }
    return entry;
  });

  const completeness = (e: QueryLineageEntry): number =>
    (e.actionType ? 1 : 0) + (e.api ? 1 : 0) + (e.matchType === "value" ? 1 : 0);
  return entries.sort((a, b) => completeness(b) - completeness(a));
};
```

- [ ] **Step 4: PASS doğrula**

Run: `cd packages/sentinel && npx vitest run`
Expected: PASS (stateQuery + lineageQuery, toplam 11 test)

- [ ] **Step 5: Commit**

```bash
cd /Users/orhanfhb/Projects/sentinel
git add packages/sentinel/src/utils/lineage.ts packages/sentinel/src/utils/__tests__/lineageQuery.test.ts
git commit -m "feat: reverse lineage from free-text query (state -> action -> API)"
```

---

### Task 3: Bridge modülü (tarayıcı → MCP process)

**Files:**
- Create: `packages/sentinel/src/bridge/protocol.ts`
- Create: `packages/sentinel/src/bridge/createSentinelBridge.ts`
- Test: `packages/sentinel/src/bridge/__tests__/createSentinelBridge.test.ts`

**Interfaces:**
- Consumes: `EffectRecord`, `ActionRecord` tipleri (mevcut).
- Produces (Task 5, 7, 8, 9 kullanır):

```ts
// protocol.ts
export type SnapshotData = {
  state: unknown;
  serverState?: unknown;
  clientEffects: EffectRecord[];
  serverEffects?: EffectRecord[];
  clientActions: ActionRecord[];
  serverActions?: ActionRecord[];
};
export type Snapshot = SnapshotData & { tabId: string; url: string; title: string; timestamp: number };
export type BrowserMessage =
  | { kind: "register"; tabId: string; url: string; title: string }
  | { kind: "active"; tabId: string }
  | { kind: "snapshot"; requestId: string; snapshot: Snapshot };
export type ServerMessage = { kind: "snapshot-request"; requestId: string };
export const DEFAULT_MCP_URL = "ws://localhost:8790";

// createSentinelBridge.ts
export type SentinelBridgeOptions = {
  url?: string;
  getSnapshot: () => SnapshotData;
  WebSocketImpl?: typeof WebSocket; // test injection
};
export type SentinelBridge = { dispose: () => void };
export const createSentinelBridge: (options: SentinelBridgeOptions) => SentinelBridge;
```

- [ ] **Step 1: protocol.ts'i yaz** (tip dosyası — testi bridge testiyle birlikte)

```ts
// packages/sentinel/src/bridge/protocol.ts
import type { EffectRecord } from "../saga/createSentinelSagaMonitor";
import type { ActionRecord } from "../redux/createSentinelReduxMiddleware";

export type SnapshotData = {
  state: unknown;
  serverState?: unknown;
  clientEffects: EffectRecord[];
  serverEffects?: EffectRecord[];
  clientActions: ActionRecord[];
  serverActions?: ActionRecord[];
};

export type Snapshot = SnapshotData & {
  tabId: string;
  url: string;
  title: string;
  timestamp: number;
};

export type BrowserMessage =
  | { kind: "register"; tabId: string; url: string; title: string }
  | { kind: "active"; tabId: string }
  | { kind: "snapshot"; requestId: string; snapshot: Snapshot };

export type ServerMessage = { kind: "snapshot-request"; requestId: string };

export const DEFAULT_MCP_URL = "ws://localhost:8790";
```

- [ ] **Step 2: Failing testi yaz**

```ts
// packages/sentinel/src/bridge/__tests__/createSentinelBridge.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSentinelBridge } from "../createSentinelBridge";
import type { BrowserMessage, ServerMessage } from "../protocol";

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.(); }
  // test helpers
  open() { this.readyState = 1; this.onopen?.(); }
  receive(msg: ServerMessage) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  messages(): BrowserMessage[] { return this.sent.map((s) => JSON.parse(s)); }
}

const snapshotData = {
  state: { a: 1 },
  clientEffects: [],
  clientActions: [],
};

describe("createSentinelBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
  });
  afterEach(() => vi.useRealTimers());

  const create = () =>
    createSentinelBridge({
      url: "ws://localhost:9999",
      getSnapshot: () => snapshotData,
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

  it("registers on open with tab metadata", () => {
    const bridge = create();
    const ws = MockWebSocket.instances[0];
    ws.open();
    const register = ws.messages().find((m) => m.kind === "register");
    expect(register).toMatchObject({ kind: "register" });
    expect((register as { tabId: string }).tabId.length).toBeGreaterThan(0);
    bridge.dispose();
  });

  it("answers snapshot-request with snapshot + tab metadata", () => {
    const bridge = create();
    const ws = MockWebSocket.instances[0];
    ws.open();
    ws.receive({ kind: "snapshot-request", requestId: "42" });
    const snap = ws.messages().find((m) => m.kind === "snapshot");
    expect(snap).toBeDefined();
    const s = snap as Extract<BrowserMessage, { kind: "snapshot" }>;
    expect(s.requestId).toBe("42");
    expect(s.snapshot.state).toEqual({ a: 1 });
    expect(typeof s.snapshot.timestamp).toBe("number");
    bridge.dispose();
  });

  it("reconnects with backoff after close", () => {
    const bridge = create();
    expect(MockWebSocket.instances.length).toBe(1);
    MockWebSocket.instances[0].open();
    MockWebSocket.instances[0].close();
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(2);
    MockWebSocket.instances[1].close();
    vi.advanceTimersByTime(1999);
    expect(MockWebSocket.instances.length).toBe(2); // 2s dolmadan yeni bağlantı yok
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances.length).toBe(3);
    bridge.dispose();
  });

  it("stops reconnecting after dispose", () => {
    const bridge = create();
    MockWebSocket.instances[0].open();
    bridge.dispose();
    vi.advanceTimersByTime(60000);
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("sends active signal on window focus", () => {
    const bridge = create();
    const ws = MockWebSocket.instances[0];
    ws.open();
    window.dispatchEvent(new Event("focus"));
    expect(ws.messages().filter((m) => m.kind === "active").length).toBeGreaterThanOrEqual(1);
    bridge.dispose();
  });
});
```

- [ ] **Step 3: FAIL doğrula**

Run: `cd packages/sentinel && npx vitest run src/bridge`
Expected: FAIL — `Cannot find module '../createSentinelBridge'`

- [ ] **Step 4: Implementasyonu yaz**

```ts
// packages/sentinel/src/bridge/createSentinelBridge.ts
import {
  DEFAULT_MCP_URL,
  type BrowserMessage,
  type ServerMessage,
  type SnapshotData,
} from "./protocol";

export type SentinelBridgeOptions = {
  url?: string;
  getSnapshot: () => SnapshotData;
  WebSocketImpl?: typeof WebSocket;
};

export type SentinelBridge = { dispose: () => void };

const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30000;

// Tarayıcı → sentinel-mcp process köprüsü. Bağlantı koptuğunda sessizce
// (console'a yazmadan) exponential backoff ile yeniden dener; MCP process
// çalışmıyorken sayfaya etkisi tek başarısız bağlantı denemesidir.
export const createSentinelBridge = (options: SentinelBridgeOptions): SentinelBridge => {
  const WS = options.WebSocketImpl ?? (typeof WebSocket !== "undefined" ? WebSocket : undefined);
  if (!WS || typeof window === "undefined") return { dispose: () => {} };

  const wsUrl = options.url ?? DEFAULT_MCP_URL;
  const tabId = Math.random().toString(36).slice(2, 10);
  let ws: WebSocket | null = null;
  let disposed = false;
  let backoff = BACKOFF_START_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const send = (msg: BrowserMessage): void => {
    if (ws && ws.readyState === WS.OPEN) ws.send(JSON.stringify(msg));
  };

  const connect = (): void => {
    if (disposed) return;
    ws = new WS(wsUrl);
    ws.onopen = () => {
      backoff = BACKOFF_START_MS;
      send({ kind: "register", tabId, url: location.href, title: document.title });
      if (document.visibilityState === "visible") send({ kind: "active", tabId });
    };
    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (msg.kind === "snapshot-request") {
        send({
          kind: "snapshot",
          requestId: msg.requestId,
          snapshot: {
            ...options.getSnapshot(),
            tabId,
            url: location.href,
            title: document.title,
            timestamp: Date.now(),
          },
        });
      }
    };
    ws.onclose = () => {
      ws = null;
      if (disposed) return;
      reconnectTimer = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
    };
    ws.onerror = () => {
      // onclose tetiklenir; burada sadece susuyoruz (console spam yok)
    };
  };

  const onFocus = (): void => send({ kind: "active", tabId });
  const onVisibility = (): void => {
    if (document.visibilityState === "visible") onFocus();
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);
  connect();

  return {
    dispose: () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      ws?.close();
    },
  };
};
```

- [ ] **Step 5: PASS doğrula**

Run: `cd packages/sentinel && npx vitest run src/bridge`
Expected: PASS (5 test)

- [ ] **Step 6: Commit**

```bash
cd /Users/orhanfhb/Projects/sentinel
git add packages/sentinel/src/bridge/
git commit -m "feat: websocket bridge publishing snapshots to sentinel-mcp"
```

---

### Task 4: `./core` subpath entry (Node tüketicisi için headless export)

`@sentinel-core/mcp` Node'da çalışır; ana entry CSS + React içerir. Headless kod için ikinci entry.

**Files:**
- Create: `packages/sentinel/src/core.ts`
- Modify: `packages/sentinel/vite.config.ts` (multi-entry)
- Modify: `packages/sentinel/package.json` (exports map)

**Interfaces:**
- Produces: `@sentinel-core/sentinel/core` — `buildLineageFromQuery`, `searchStateByQuery`, `extractApiCalls`, `sortApiCalls`, `buildCurl` fonksiyonları; `Snapshot`, `SnapshotData`, `BrowserMessage`, `ServerMessage`, `QueryLineageEntry`, `QueryLineageInput`, `StateQueryMatch`, `ApiCall`, `EffectRecord`, `ActionRecord` tipleri; `DEFAULT_MCP_URL` sabiti. Task 6-9 bunları import eder.

- [ ] **Step 1: core.ts oluştur**

```ts
// packages/sentinel/src/core.ts
// Headless entry: React ve CSS içermez — Node tüketicileri (sentinel-mcp) için.
export {
  buildLineage,
  buildLineageFromQuery,
} from "./utils/lineage";
export type {
  LineageEntry,
  LineageInput,
  QueryLineageEntry,
  QueryLineageInput,
} from "./utils/lineage";
export { searchStateByQuery } from "./utils/stateQuery";
export type { StateQueryMatch } from "./utils/stateQuery";
export { extractApiCalls, correlateProps, sortApiCalls, buildCurl } from "./utils/apiCalls";
export type { ApiCall, PropMatch } from "./utils/apiCalls";
export type {
  EffectRecord,
  EffectStatus,
  EffectType,
  SentinelSagaMonitor,
} from "./saga/createSentinelSagaMonitor";
export type {
  ActionRecord,
  DiffEntry,
  DiffType,
  SentinelReduxMiddleware,
} from "./redux/createSentinelReduxMiddleware";
export { DEFAULT_MCP_URL } from "./bridge/protocol";
export type { Snapshot, SnapshotData, BrowserMessage, ServerMessage } from "./bridge/protocol";
```

- [ ] **Step 2: vite.config.ts'te multi-entry**

`build.lib` bloğunu şu şekilde değiştir (dosyanın kalanı aynı kalır):

```ts
  build: {
    target: "es2019",
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        core: path.resolve(__dirname, "src/core.ts"),
      },
      name: "Sentinel",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        const base = entryName === "index" ? "sentinel" : entryName;
        return format === "cjs" ? `${base}.cjs` : `${base}.${format}.js`;
      },
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
  },
```

- [ ] **Step 3: package.json exports'a core ekle**

```json
  "exports": {
    ".": {
      "types": "./dist/src/index.d.ts",
      "import": "./dist/sentinel.es.js",
      "require": "./dist/sentinel.cjs"
    },
    "./core": {
      "types": "./dist/src/core.d.ts",
      "import": "./dist/core.es.js",
      "require": "./dist/core.cjs"
    },
    "./index.css": "./dist/sentinel.css"
  },
```

- [ ] **Step 4: Build doğrula**

Run: `cd packages/sentinel && npm run build && ls dist/core.es.js dist/core.cjs dist/src/core.d.ts`
Expected: üç dosya da listelenir; build hatasız. `node -e "import('/Users/orhanfhb/Projects/sentinel/packages/sentinel/dist/core.es.js').then(m => console.log(typeof m.buildLineageFromQuery))"` çıktısı `function` (React'sız Node import kanıtı).

- [ ] **Step 5: Commit**

```bash
cd /Users/orhanfhb/Projects/sentinel
git add packages/sentinel/src/core.ts packages/sentinel/vite.config.ts packages/sentinel/package.json
git commit -m "feat: headless core entry for node consumers"
```

---

### Task 5: Provider `mcp` prop'u

**Files:**
- Modify: `packages/sentinel/src/react/provider.tsx`
- Test: `packages/sentinel/src/react/__tests__/providerMcp.test.tsx`

**Interfaces:**
- Consumes: `createSentinelBridge` (Task 3).
- Produces: `SentinelProvider`'a yeni opsiyonel prop `mcp?: { url?: string }`. Storefront (Task 10) bunu kullanır.

- [ ] **Step 1: Failing testi yaz**

```tsx
// packages/sentinel/src/react/__tests__/providerMcp.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOM from "react-dom";
import { SentinelProvider } from "../provider";

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; }
}

describe("SentinelProvider mcp prop", () => {
  let container: HTMLDivElement;
  const RealWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as Record<string, unknown>).WebSocket = MockWebSocket;
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    (globalThis as Record<string, unknown>).WebSocket = RealWebSocket;
  });

  it("connects the bridge when mcp prop is given", () => {
    ReactDOM.render(
      <SentinelProvider mcp={{ url: "ws://localhost:9999" }}>
        <div>app</div>
      </SentinelProvider>,
      container,
    );
    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toBe("ws://localhost:9999");
  });

  it("does not connect without the mcp prop", () => {
    ReactDOM.render(
      <SentinelProvider>
        <div>app</div>
      </SentinelProvider>,
      container,
    );
    expect(MockWebSocket.instances.length).toBe(0);
  });
});
```

- [ ] **Step 2: FAIL doğrula**

Run: `cd packages/sentinel && npx vitest run src/react`
Expected: FAIL — ilk test: `expected 0 to be 1` (mcp prop henüz yok, bridge kurulmuyor)

- [ ] **Step 3: provider.tsx'i değiştir**

Import bloğuna ekle:

```tsx
import { createSentinelBridge } from "../bridge/createSentinelBridge";
```

Props tipine ve destructure'a `mcp` ekle:

```tsx
export const SentinelProvider = ({
  children,
  store: reduxStore,
  sagaMonitor,
  reduxMiddleware,
  serverState,
  serverSagaEffects,
  serverActionLog,
  externalLinks,
  mcp,
}: {
  children: React.ReactNode;
  store?: ReduxStore;
  sagaMonitor?: SentinelSagaMonitor;
  reduxMiddleware?: SentinelReduxMiddleware;
  serverState?: unknown;
  serverSagaEffects?: EffectRecord[];
  serverActionLog?: ActionRecord[];
  externalLinks?: ExternalLink[];
  mcp?: { url?: string };
}) => {
```

Mevcut `useEffect`'lerin yanına (component gövdesine) ekle:

```tsx
  useEffect(() => {
    if (!mcp) return;
    const bridge = createSentinelBridge({
      url: mcp.url,
      getSnapshot: () => ({
        state: reduxStore?.getState(),
        serverState,
        clientEffects: sagaMonitor?._getSerializableEffects() ?? [],
        serverEffects: serverSagaEffects,
        clientActions: reduxMiddleware?._getSerializableRecords() ?? [],
        serverActions: serverActionLog,
      }),
    });
    return bridge.dispose;
    // Köprü mount'ta bir kez kurulur; monitor/store referansları uygulama
    // ömrü boyunca sabittir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: PASS doğrula + tüm suite**

Run: `cd packages/sentinel && npx vitest run && npm run build`
Expected: tüm testler PASS, build hatasız.

- [ ] **Step 5: Commit**

```bash
cd /Users/orhanfhb/Projects/sentinel
git add packages/sentinel/src/react/provider.tsx packages/sentinel/src/react/__tests__/providerMcp.test.tsx
git commit -m "feat: mcp prop wiring bridge into SentinelProvider"
```

---

### Task 6: `packages/sentinel-mcp` scaffold + TabRegistry

**Files:**
- Create: `packages/sentinel-mcp/package.json`
- Create: `packages/sentinel-mcp/tsconfig.json`
- Create: `packages/sentinel-mcp/tsup.config.ts`
- Create: `packages/sentinel-mcp/src/tabRegistry.ts`
- Test: `packages/sentinel-mcp/src/__tests__/tabRegistry.test.ts`
- Modify: `package.json` (monorepo root — workspaces + build script)

**Interfaces:**
- Produces: `TabRegistry` class — `register({tabId,url,title})`, `markActive(tabId)`, `remove(tabId)`, `resolve(tabId?): TabInfo | undefined`, `list(): (TabInfo & {active: boolean})[]`. Task 7 ve 9 kullanır.

- [ ] **Step 1: Root workspaces'e ekle**

Root `package.json`: `"workspaces"` dizisine `"packages/sentinel-mcp"` ekle (playground-webpack'ten önce). `"build"` script'ini şu yap:

```json
"build": "npm run build --workspace=packages/sentinel && npm run build --workspace=packages/sentinel-plugin && npm run build --workspace=packages/sentinel-mcp"
```

- [ ] **Step 2: Paket dosyalarını oluştur**

```json
// packages/sentinel-mcp/package.json
{
  "name": "@sentinel-core/mcp",
  "version": "0.1.0",
  "description": "MCP server exposing sentinel runtime data to coding agents",
  "author": "firatorhan",
  "private": false,
  "publishConfig": { "access": "public" },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/firatorhan/sentinel.git",
    "directory": "packages/sentinel-mcp"
  },
  "keywords": ["sentinel", "mcp", "modelcontextprotocol", "observability"],
  "type": "module",
  "bin": { "sentinel-mcp": "dist/cli.js" },
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsup",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@sentinel-core/sentinel": "*",
    "ws": "^8.18.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^24.12.3",
    "@types/ws": "^8.5.12",
    "tsup": "^8.0.0",
    "typescript": "~6.0.2",
    "vitest": "^4.0.0"
  }
}
```

Not: `"*"` workspace içinde lokal link'lenir (registry'ye gitmez); Task 10'da publish'ten hemen önce `"^1.0.61"` olarak pinlenir.

```json
// packages/sentinel-mcp/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src"]
}
```

```ts
// packages/sentinel-mcp/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: ["esm"],
  dts: { entry: { index: "src/index.ts" } },
  target: "node18",
  clean: true,
});
```

`src/index.ts` registry'yi export eder (Task 9'da genişler); `src/cli.ts` tsup entry'sinin build alabilmesi için geçici boş modüldür (Task 9'da gerçek içerik gelir):

```ts
// packages/sentinel-mcp/src/index.ts
export { TabRegistry } from "./tabRegistry";
export type { TabInfo } from "./tabRegistry";
```

```ts
// packages/sentinel-mcp/src/cli.ts — geçici; Task 9'da değiştirilir
export {};
```

- [ ] **Step 3: Failing testi yaz**

```ts
// packages/sentinel-mcp/src/__tests__/tabRegistry.test.ts
import { describe, it, expect } from "vitest";
import { TabRegistry } from "../tabRegistry";

describe("TabRegistry", () => {
  const tabA = { tabId: "a", url: "http://x/1", title: "One" };
  const tabB = { tabId: "b", url: "http://x/2", title: "Two" };

  it("first registered tab becomes active by default", () => {
    const r = new TabRegistry();
    r.register(tabA);
    r.register(tabB);
    expect(r.resolve()?.tabId).toBe("a");
  });

  it("markActive switches the default tab", () => {
    const r = new TabRegistry();
    r.register(tabA);
    r.register(tabB);
    r.markActive("b");
    expect(r.resolve()?.tabId).toBe("b");
  });

  it("resolve with explicit tabId wins over active", () => {
    const r = new TabRegistry();
    r.register(tabA);
    r.register(tabB);
    r.markActive("b");
    expect(r.resolve("a")?.tabId).toBe("a");
    expect(r.resolve("yok")).toBeUndefined();
  });

  it("remove falls back to another tab", () => {
    const r = new TabRegistry();
    r.register(tabA);
    r.register(tabB);
    r.markActive("b");
    r.remove("b");
    expect(r.resolve()?.tabId).toBe("a");
    r.remove("a");
    expect(r.resolve()).toBeUndefined();
  });

  it("list marks the active tab", () => {
    const r = new TabRegistry();
    r.register(tabA);
    r.register(tabB);
    r.markActive("b");
    const list = r.list();
    expect(list.find((t) => t.tabId === "b")?.active).toBe(true);
    expect(list.find((t) => t.tabId === "a")?.active).toBe(false);
  });
});
```

- [ ] **Step 4: Install + FAIL doğrula**

```bash
cd /Users/orhanfhb/Projects/sentinel && npm install
cd packages/sentinel-mcp && npx vitest run
```
Expected: FAIL — `Cannot find module '../tabRegistry'`

- [ ] **Step 5: Implementasyon**

```ts
// packages/sentinel-mcp/src/tabRegistry.ts
export type TabInfo = {
  tabId: string;
  url: string;
  title: string;
  connectedAt: number;
  lastActiveAt?: number;
};

// Bağlı sekmelerin kaydı. tab_id verilmeyen tool çağrıları son aktif
// sekmeye gider; hiç aktiflik sinyali gelmediyse ilk bağlanan sekme aktiftir.
export class TabRegistry {
  private tabs = new Map<string, TabInfo>();
  private activeTabId: string | null = null;

  register(info: { tabId: string; url: string; title: string }): void {
    this.tabs.set(info.tabId, { ...info, connectedAt: Date.now() });
    if (!this.activeTabId) this.activeTabId = info.tabId;
  }

  markActive(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    this.activeTabId = tabId;
    tab.lastActiveAt = Date.now();
  }

  remove(tabId: string): void {
    this.tabs.delete(tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs.keys().next().value ?? null;
    }
  }

  resolve(tabId?: string): TabInfo | undefined {
    if (tabId) return this.tabs.get(tabId);
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined;
  }

  list(): (TabInfo & { active: boolean })[] {
    return Array.from(this.tabs.values()).map((tab) => ({
      ...tab,
      active: tab.tabId === this.activeTabId,
    }));
  }
}
```

- [ ] **Step 6: PASS + build doğrula**

Run: `cd packages/sentinel-mcp && npx vitest run && npm run build && ls dist/index.js dist/cli.js`
Expected: 5 test PASS; `dist/index.js` ve `dist/cli.js` üretilmiş.

- [ ] **Step 7: Commit**

```bash
cd /Users/orhanfhb/Projects/sentinel
git add packages/sentinel-mcp/ package.json package-lock.json
git commit -m "feat: sentinel-mcp workspace scaffold with tab registry"
```

---

### Task 7: BridgeServer (WS sunucusu + snapshot pull)

**Files:**
- Create: `packages/sentinel-mcp/src/bridgeServer.ts`
- Test: `packages/sentinel-mcp/src/__tests__/bridgeServer.test.ts`

**Interfaces:**
- Consumes: `TabRegistry` (Task 6); `Snapshot`, `BrowserMessage`, `ServerMessage` (`@sentinel-core/sentinel/core`); `ws` paketi.
- Produces: `BridgeServer` class — `constructor(port: number)`, `ready(): Promise<number>` (dinlenen portu döner), `requestSnapshot(tabId?: string): Promise<Snapshot>`, `close(): Promise<void>`, `readonly registry: TabRegistry`. Task 9 kullanır.

- [ ] **Step 1: Failing testi yaz**

```ts
// packages/sentinel-mcp/src/__tests__/bridgeServer.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import { BridgeServer } from "../bridgeServer";
import type { ServerMessage, Snapshot } from "@sentinel-core/sentinel/core";

const snapshot: Snapshot = {
  tabId: "t1",
  url: "http://localhost/x",
  title: "X",
  timestamp: 1,
  state: { a: 1 },
  clientEffects: [],
  clientActions: [],
};

// Sahte tarayıcı: register olur, snapshot-request'e cevap verir
const connectFakeTab = (port: number, tabId: string, respond = true): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("error", reject);
    ws.on("open", () => {
      ws.send(JSON.stringify({ kind: "register", tabId, url: "http://localhost/x", title: "X" }));
      ws.on("message", (data) => {
        const msg = JSON.parse(String(data)) as ServerMessage;
        if (msg.kind === "snapshot-request" && respond) {
          ws.send(
            JSON.stringify({
              kind: "snapshot",
              requestId: msg.requestId,
              snapshot: { ...snapshot, tabId },
            }),
          );
        }
      });
      resolve(ws);
    });
  });

describe("BridgeServer", () => {
  let server: BridgeServer;
  let port: number;
  const sockets: WebSocket[] = [];

  beforeEach(async () => {
    server = new BridgeServer(0); // 0 → OS boş port seçer
    port = await server.ready();
  });
  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.close());
    await server.close();
  });

  it("rejects when no tab is connected", async () => {
    await expect(server.requestSnapshot()).rejects.toThrow(/No browser tab connected/);
  });

  it("pulls a snapshot from the registered tab", async () => {
    sockets.push(await connectFakeTab(port, "t1"));
    const snap = await server.requestSnapshot();
    expect(snap.state).toEqual({ a: 1 });
    expect(snap.tabId).toBe("t1");
  });

  it("routes to an explicit tabId", async () => {
    sockets.push(await connectFakeTab(port, "t1"));
    sockets.push(await connectFakeTab(port, "t2"));
    const snap = await server.requestSnapshot("t2");
    expect(snap.tabId).toBe("t2");
  });

  it("times out when the tab does not respond", async () => {
    sockets.push(await connectFakeTab(port, "t1", false));
    await expect(server.requestSnapshot()).rejects.toThrow(/did not respond/);
  }, 10000);

  it("removes the tab from registry on disconnect", async () => {
    const ws = await connectFakeTab(port, "t1");
    expect(server.registry.list().length).toBe(1);
    ws.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(server.registry.list().length).toBe(0);
  });
});
```

- [ ] **Step 2: FAIL doğrula**

Run: `cd packages/sentinel-mcp && npx vitest run src/__tests__/bridgeServer.test.ts`
Expected: FAIL — `Cannot find module '../bridgeServer'`

Not: `@sentinel-core/sentinel/core` import'u için Task 4'ün build'i gerekir (`npm run build --workspace=packages/sentinel` çalıştırılmış olmalı).

- [ ] **Step 3: Implementasyon**

```ts
// packages/sentinel-mcp/src/bridgeServer.ts
import { WebSocketServer, WebSocket } from "ws";
import type { BrowserMessage, ServerMessage, Snapshot } from "@sentinel-core/sentinel/core";
import { TabRegistry } from "./tabRegistry";

const SNAPSHOT_TIMEOUT_MS = 3000;

export const NO_TAB_MESSAGE =
  "No browser tab connected. Open the app locally with sentinel enabled (sentinelEnabled + mcp prop).";

type PendingRequest = {
  resolve: (snapshot: Snapshot) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// Tarayıcı sekmelerinin bağlandığı WebSocket sunucusu. Snapshot tutmaz —
// her tool çağrısında aktif sekmeden taze snapshot pull edilir.
export class BridgeServer {
  readonly registry = new TabRegistry();
  private wss: WebSocketServer;
  private sockets = new Map<string, WebSocket>();
  private pending = new Map<string, PendingRequest>();
  private nextRequestId = 0;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (socket) => {
      let tabId: string | undefined;
      socket.on("message", (data) => {
        let msg: BrowserMessage;
        try {
          msg = JSON.parse(String(data));
        } catch {
          return;
        }
        if (msg.kind === "register") {
          tabId = msg.tabId;
          this.sockets.set(msg.tabId, socket);
          this.registry.register(msg);
        } else if (msg.kind === "active") {
          this.registry.markActive(msg.tabId);
        } else if (msg.kind === "snapshot") {
          const request = this.pending.get(msg.requestId);
          if (request) {
            clearTimeout(request.timer);
            this.pending.delete(msg.requestId);
            request.resolve(msg.snapshot);
          }
        }
      });
      socket.on("close", () => {
        if (tabId) {
          this.sockets.delete(tabId);
          this.registry.remove(tabId);
        }
      });
    });
  }

  ready(): Promise<number> {
    return new Promise((resolve, reject) => {
      const address = this.wss.address();
      if (address && typeof address === "object") {
        resolve(address.port);
        return;
      }
      this.wss.once("listening", () => {
        const addr = this.wss.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
      this.wss.once("error", reject);
    });
  }

  requestSnapshot(tabId?: string): Promise<Snapshot> {
    const tab = this.registry.resolve(tabId);
    if (!tab) return Promise.reject(new Error(NO_TAB_MESSAGE));
    const socket = this.sockets.get(tab.tabId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(NO_TAB_MESSAGE));
    }
    const requestId = String(++this.nextRequestId);
    const message: ServerMessage = { kind: "snapshot-request", requestId };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new Error(
            `Tab "${tab.tabId}" (${tab.url}) did not respond within ${SNAPSHOT_TIMEOUT_MS}ms. Use list_tabs to inspect connections.`,
          ),
        );
      }, SNAPSHOT_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify(message));
    });
  }

  close(): Promise<void> {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Server closing"));
    }
    this.pending.clear();
    for (const socket of this.sockets.values()) socket.terminate();
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }
}
```

- [ ] **Step 4: PASS doğrula**

Run: `cd packages/sentinel-mcp && npx vitest run src/__tests__/bridgeServer.test.ts`
Expected: PASS (5 test; timeout testi ~3 sn sürer)

- [ ] **Step 5: Commit**

```bash
cd /Users/orhanfhb/Projects/sentinel
git add packages/sentinel-mcp/src/bridgeServer.ts packages/sentinel-mcp/src/__tests__/bridgeServer.test.ts
git commit -m "feat: bridge server pulling snapshots from browser tabs"
```

---

### Task 8: Tool mantığı (snapshot → metin)

**Files:**
- Create: `packages/sentinel-mcp/src/tools/format.ts`
- Create: `packages/sentinel-mcp/src/tools/lineage.ts`
- Create: `packages/sentinel-mcp/src/tools/apiCalls.ts`
- Create: `packages/sentinel-mcp/src/tools/state.ts`
- Create: `packages/sentinel-mcp/src/tools/actionLog.ts`
- Test: `packages/sentinel-mcp/src/tools/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `buildLineageFromQuery`, `searchStateByQuery`, `extractApiCalls`, `Snapshot`, `ApiCall` (`@sentinel-core/sentinel/core`).
- Produces (Task 9 kullanır):
  - `formatLineage(snapshot: Snapshot, query: string): string`
  - `listApiCalls(snapshot: Snapshot): string`
  - `findDuplicates(snapshot: Snapshot): string`
  - `formatState(snapshot: Snapshot, opts: { path?: string; query?: string }): string`
  - `formatActionLog(snapshot: Snapshot, limit?: number): string`

- [ ] **Step 1: Failing testleri yaz**

```ts
// packages/sentinel-mcp/src/tools/__tests__/tools.test.ts
import { describe, it, expect } from "vitest";
import type { Snapshot } from "@sentinel-core/sentinel/core";
import { formatLineage } from "../lineage";
import { listApiCalls, findDuplicates } from "../apiCalls";
import { formatState } from "../state";
import { formatActionLog } from "../actionLog";

const axiosResult = (url: string) => ({
  status: 200,
  statusText: "OK",
  data: { prices: [{ value: 1299 }] },
  config: { url, method: "get", baseURL: "https://api.example.com" },
});

const snapshot: Snapshot = {
  tabId: "t1",
  url: "http://localhost:3000/urun",
  title: "Ürün",
  timestamp: 1000,
  state: { productState: { product: { prices: [{ value: 1299 }] } } },
  clientEffects: [
    { id: 1, parentId: 0, type: "FORK", fnName: "loadProduct", args: [], status: "resolved", startedAt: 50 },
    { id: 2, parentId: 1, type: "CALL", fnName: "getProduct", args: [], status: "resolved", startedAt: 100, duration: 340, result: axiosResult("/productDetail") },
    { id: 3, parentId: 1, type: "PUT", fnName: "GET_PRODUCT_FULFILLED", args: [{ type: "GET_PRODUCT_FULFILLED", payload: { prices: [{ value: 1299 }] } }], status: "resolved", startedAt: 200 },
    // Duplicate: aynı URL ikinci kez
    { id: 4, parentId: 0, type: "CALL", fnName: "getProduct", args: [], status: "resolved", startedAt: 300, duration: 120, result: axiosResult("/productDetail") },
  ],
  serverEffects: [
    { id: 1, parentId: 0, type: "CALL", fnName: "getProduct", args: [], status: "resolved", startedAt: 10, duration: 90, result: axiosResult("/productDetail") },
  ],
  clientActions: [
    { id: 1, action: { type: "GET_PRODUCT_FULFILLED", payload: { prices: [{ value: 1299 }] } }, diff: [{ path: "productState.product", type: "changed" }], timestamp: 200 },
  ],
};

describe("tool formatters", () => {
  it("formatLineage renders the full chain", () => {
    const out = formatLineage(snapshot, "price");
    expect(out).toContain("productState.product.prices[0].value");
    expect(out).toContain("GET_PRODUCT_FULFILLED");
    expect(out).toContain("GET https://api.example.com/productDetail");
  });

  it("formatLineage explains empty results", () => {
    expect(formatLineage(snapshot, "yokboyleveri")).toContain("No match");
  });

  it("listApiCalls lists client and server calls with duration", () => {
    const out = listApiCalls(snapshot);
    expect(out).toContain("GET https://api.example.com/productDetail");
    expect(out).toContain("client");
    expect(out).toContain("server");
    expect(out).toContain("340ms");
  });

  it("findDuplicates flags repeated and double-fetched calls", () => {
    const out = findDuplicates(snapshot);
    expect(out).toContain("productDetail");
    expect(out).toContain("3x"); // 2 client + 1 server
    expect(out).toContain("double-fetch");
  });

  it("formatState resolves a path", () => {
    const out = formatState(snapshot, { path: "productState.product.prices[0].value" });
    expect(out).toContain("1299");
  });

  it("formatState searches by query", () => {
    const out = formatState(snapshot, { query: "price" });
    expect(out).toContain("productState.product.prices[0].value");
  });

  it("formatState without args summarizes top-level keys", () => {
    const out = formatState(snapshot, {});
    expect(out).toContain("productState");
  });

  it("formatActionLog lists actions with diff summaries", () => {
    const out = formatActionLog(snapshot);
    expect(out).toContain("GET_PRODUCT_FULFILLED");
    expect(out).toContain("productState.product");
  });
});
```

- [ ] **Step 2: FAIL doğrula**

Run: `cd packages/sentinel-mcp && npx vitest run src/tools`
Expected: FAIL — modüller yok

- [ ] **Step 3: Implementasyonlar**

```ts
// packages/sentinel-mcp/src/tools/format.ts
export const MAX_JSON_CHARS = 4000;

export const truncateJson = (value: unknown, maxChars = MAX_JSON_CHARS): string => {
  const json = JSON.stringify(value, null, 2) ?? "undefined";
  if (json.length <= maxChars) return json;
  return `${json.slice(0, maxChars)}\n… (${json.length - maxChars} chars truncated)`;
};

export const formatTime = (timestamp: number): string => new Date(timestamp).toISOString();

// "a.b[0].c" → state içindeki değer
export const getAtPath = (root: unknown, path: string): unknown => {
  const segments = path
    .split(/[.[]/)
    .map((s) => s.replace(/\]$/, ""))
    .filter(Boolean);
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};
```

```ts
// packages/sentinel-mcp/src/tools/lineage.ts
import { buildLineageFromQuery, type Snapshot } from "@sentinel-core/sentinel/core";
import { formatTime } from "./format";

export const formatLineage = (snapshot: Snapshot, query: string): string => {
  const entries = buildLineageFromQuery({
    query,
    state: snapshot.state,
    serverState: snapshot.serverState,
    clientActions: snapshot.clientActions,
    serverActions: snapshot.serverActions,
    clientEffects: snapshot.clientEffects,
    serverEffects: snapshot.serverEffects,
  });
  if (entries.length === 0) {
    return `No match for "${query}" in state, actions or API calls of ${snapshot.url}. Try get_state with a query to explore, or a longer/different term.`;
  }
  return entries
    .map((entry) => {
      const lines = [`${entry.statePath} = ${entry.preview} (${entry.matchType} match)`];
      if (entry.actionType) {
        lines.push(
          `  ← ${entry.actionType} (${entry.actionOrigin}, ${formatTime(entry.actionTimestamp ?? 0)})`,
        );
      }
      if (entry.api) {
        const status = entry.api.status !== undefined ? `${entry.api.status}` : "?";
        const duration = entry.api.duration !== undefined ? `, ${entry.api.duration}ms` : "";
        lines.push(`  ← ${entry.api.method} ${entry.api.url} (${status}${duration}, ${entry.api.origin})`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
};
```

```ts
// packages/sentinel-mcp/src/tools/apiCalls.ts
import { extractApiCalls, type ApiCall, type Snapshot } from "@sentinel-core/sentinel/core";
import { formatTime } from "./format";

export const allCalls = (snapshot: Snapshot): ApiCall[] => [
  ...extractApiCalls(snapshot.clientEffects, undefined, "client"),
  ...extractApiCalls(snapshot.serverEffects ?? [], undefined, "server"),
];

export const listApiCalls = (snapshot: Snapshot): string => {
  const calls = allCalls(snapshot).sort((a, b) => a.startedAt - b.startedAt);
  if (calls.length === 0) return `No API calls captured on ${snapshot.url}.`;
  return calls
    .map((call) => {
      const status = call.responseStatus ?? (call.errorMessage ? "ERR" : "?");
      const duration = call.duration !== undefined ? `${call.duration}ms` : "-";
      const error = call.errorMessage ? ` error="${call.errorMessage}"` : "";
      return `[${call.origin}] ${call.method} ${call.url} → ${status} (${duration}, ${formatTime(call.startedAt)})${error}`;
    })
    .join("\n");
};

const normalizeUrl = (url: string): string => url.split("#")[0];

export const findDuplicates = (snapshot: Snapshot): string => {
  const calls = allCalls(snapshot);
  const groups = new Map<string, ApiCall[]>();
  for (const call of calls) {
    const key = `${call.method} ${normalizeUrl(call.url)}`;
    const group = groups.get(key) ?? [];
    group.push(call);
    groups.set(key, group);
  }
  const duplicates = Array.from(groups.entries()).filter(([, group]) => group.length > 1);
  if (duplicates.length === 0) return `No duplicate API calls on ${snapshot.url}.`;
  return duplicates
    .map(([key, group]) => {
      const clientCount = group.filter((c) => c.origin === "client").length;
      const serverCount = group.filter((c) => c.origin === "server").length;
      const doubleFetch = clientCount > 0 && serverCount > 0 ? " ⚠ double-fetch (server + client)" : "";
      return `${group.length}x ${key} (client: ${clientCount}, server: ${serverCount})${doubleFetch}`;
    })
    .join("\n");
};
```

```ts
// packages/sentinel-mcp/src/tools/state.ts
import { searchStateByQuery, type Snapshot } from "@sentinel-core/sentinel/core";
import { getAtPath, truncateJson } from "./format";

const previewSize = (value: unknown): string => {
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (value !== null && typeof value === "object") return `object{${Object.keys(value).length} keys}`;
  return JSON.stringify(value) ?? String(value);
};

export const formatState = (
  snapshot: Snapshot,
  opts: { path?: string; query?: string },
): string => {
  const state = snapshot.state ?? snapshot.serverState;
  if (state === null || state === undefined) return `No state captured on ${snapshot.url}.`;

  if (opts.path) {
    const value = getAtPath(state, opts.path);
    if (value === undefined) return `Path "${opts.path}" not found in state. Use get_state with a query to search.`;
    return `${opts.path} =\n${truncateJson(value)}`;
  }

  if (opts.query) {
    const matches = searchStateByQuery(state, opts.query);
    if (matches.length === 0) return `No state paths or values match "${opts.query}".`;
    return matches.map((m) => `${m.path} = ${m.preview} (${m.matchType})`).join("\n");
  }

  const root = state as Record<string, unknown>;
  return Object.entries(root)
    .map(([key, value]) => `${key}: ${previewSize(value)}`)
    .join("\n");
};
```

```ts
// packages/sentinel-mcp/src/tools/actionLog.ts
import type { Snapshot } from "@sentinel-core/sentinel/core";
import { formatTime } from "./format";

const DEFAULT_LIMIT = 20;

export const formatActionLog = (snapshot: Snapshot, limit = DEFAULT_LIMIT): string => {
  const actions = [
    ...(snapshot.serverActions ?? []).map((record) => ({ record, origin: "server" as const })),
    ...snapshot.clientActions.map((record) => ({ record, origin: "client" as const })),
  ]
    .sort((a, b) => b.record.timestamp - a.record.timestamp)
    .slice(0, limit);
  if (actions.length === 0) return `No actions captured on ${snapshot.url}.`;
  return actions
    .map(({ record, origin }) => {
      const diffs = record.diff.map((d) => `    ${d.type}: ${d.path}`).join("\n");
      return `${record.action.type} (${origin}, ${formatTime(record.timestamp)})${diffs ? `\n${diffs}` : ""}`;
    })
    .join("\n");
};
```

- [ ] **Step 4: PASS doğrula**

Run: `cd packages/sentinel-mcp && npx vitest run src/tools`
Expected: PASS (8 test)

- [ ] **Step 5: Commit**

```bash
cd /Users/orhanfhb/Projects/sentinel
git add packages/sentinel-mcp/src/tools/
git commit -m "feat: mcp tool formatters over sentinel snapshots"
```

---

### Task 9: MCP server + CLI

**Files:**
- Create: `packages/sentinel-mcp/src/server.ts`
- Create: `packages/sentinel-mcp/src/cli.ts` (Task 6'daki placeholder'ı değiştirir)
- Modify: `packages/sentinel-mcp/src/index.ts`
- Test: `packages/sentinel-mcp/src/__tests__/server.test.ts`

**Interfaces:**
- Consumes: `BridgeServer` (Task 7), tool formatter'ları (Task 8), `McpServer`/`StdioServerTransport`/`InMemoryTransport` (SDK), `zod`.
- Produces: `createServer(bridge: SnapshotSource): McpServer`; `type SnapshotSource = { requestSnapshot(tabId?: string): Promise<Snapshot>; registry: { list(): (TabInfo & { active: boolean })[] } }`; `sentinel-mcp` bin'i.

- [ ] **Step 1: Failing entegrasyon testini yaz**

```ts
// packages/sentinel-mcp/src/__tests__/server.test.ts
import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Snapshot } from "@sentinel-core/sentinel/core";
import { createServer } from "../server";

const snapshot: Snapshot = {
  tabId: "t1",
  url: "http://localhost:3000/urun",
  title: "Ürün",
  timestamp: 1000,
  state: { productState: { product: { prices: [{ value: 1299 }] } } },
  clientEffects: [
    { id: 1, parentId: 0, type: "FORK", fnName: "loadProduct", args: [], status: "resolved", startedAt: 50 },
    {
      id: 2, parentId: 1, type: "CALL", fnName: "getProduct", args: [], status: "resolved", startedAt: 100, duration: 340,
      result: { status: 200, statusText: "OK", data: { prices: [{ value: 1299 }] }, config: { url: "/productDetail", method: "get", baseURL: "https://api.example.com" } },
    },
    { id: 3, parentId: 1, type: "PUT", fnName: "GET_PRODUCT_FULFILLED", args: [{ type: "GET_PRODUCT_FULFILLED", payload: { prices: [{ value: 1299 }] } }], status: "resolved", startedAt: 200 },
  ],
  clientActions: [
    { id: 1, action: { type: "GET_PRODUCT_FULFILLED", payload: { prices: [{ value: 1299 }] } }, diff: [{ path: "productState.product", type: "changed" }], timestamp: 200 },
  ],
};

const fakeBridge = {
  requestSnapshot: async () => snapshot,
  registry: {
    list: () => [
      { tabId: "t1", url: "http://localhost:3000/urun", title: "Ürün", connectedAt: 1000, active: true },
    ],
  },
};

const failingBridge = {
  requestSnapshot: async () => {
    throw new Error("No browser tab connected. Open the app locally with sentinel enabled.");
  },
  registry: { list: () => [] },
};

const connect = async (bridge: typeof fakeBridge | typeof failingBridge) => {
  const server = createServer(bridge);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
};

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>): string =>
  (result.content as { type: string; text: string }[])[0].text;

describe("sentinel MCP server", () => {
  it("exposes all six tools", async () => {
    const client = await connect(fakeBridge);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_action_log",
      "get_duplicates",
      "get_lineage",
      "get_state",
      "list_api_calls",
      "list_tabs",
    ]);
  });

  it("get_lineage returns the chain", async () => {
    const client = await connect(fakeBridge);
    const result = await client.callTool({ name: "get_lineage", arguments: { query: "price" } });
    expect(textOf(result)).toContain("GET_PRODUCT_FULFILLED");
  });

  it("list_tabs works without a snapshot", async () => {
    const client = await connect(failingBridge);
    const result = await client.callTool({ name: "list_tabs", arguments: {} });
    expect(textOf(result)).toContain("No tabs connected");
  });

  it("surfaces bridge errors as tool errors", async () => {
    const client = await connect(failingBridge);
    const result = await client.callTool({ name: "get_state", arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("No browser tab connected");
  });
});
```

- [ ] **Step 2: FAIL doğrula**

Run: `cd packages/sentinel-mcp && npx vitest run src/__tests__/server.test.ts`
Expected: FAIL — `Cannot find module '../server'`

- [ ] **Step 3: server.ts**

```ts
// packages/sentinel-mcp/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Snapshot } from "@sentinel-core/sentinel/core";
import type { TabInfo } from "./tabRegistry";
import { formatLineage } from "./tools/lineage";
import { listApiCalls, findDuplicates } from "./tools/apiCalls";
import { formatState } from "./tools/state";
import { formatActionLog } from "./tools/actionLog";
import { formatTime } from "./tools/format";

export type SnapshotSource = {
  requestSnapshot(tabId?: string): Promise<Snapshot>;
  registry: { list(): (TabInfo & { active: boolean })[] };
};

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

export const createServer = (bridge: SnapshotSource): McpServer => {
  const server = new McpServer({ name: "sentinel", version: "0.1.0" });

  const withSnapshot = async (
    tabId: string | undefined,
    render: (snapshot: Snapshot) => string,
  ) => {
    try {
      return text(render(await bridge.requestSnapshot(tabId)));
    } catch (error) {
      return {
        ...text(error instanceof Error ? error.message : String(error)),
        isError: true,
      };
    }
  };

  const tabIdSchema = z
    .string()
    .optional()
    .describe("Target tab id from list_tabs; defaults to the last active tab");

  server.registerTool(
    "get_lineage",
    {
      description:
        "Trace where a runtime value comes from in the running app: state path ← redux action ← API request. Query matches state paths (e.g. 'price') and values (e.g. '1299').",
      inputSchema: { query: z.string().min(3).describe("State path segment or value to trace"), tab_id: tabIdSchema },
    },
    ({ query, tab_id }) => withSnapshot(tab_id, (snapshot) => formatLineage(snapshot, query)),
  );

  server.registerTool(
    "list_api_calls",
    {
      description:
        "List every API request the running page made (server-side render + client), with method, URL, status, duration and origin.",
      inputSchema: { tab_id: tabIdSchema },
    },
    ({ tab_id }) => withSnapshot(tab_id, listApiCalls),
  );

  server.registerTool(
    "get_duplicates",
    {
      description:
        "Find API requests issued more than once on the running page, including server+client double-fetches.",
      inputSchema: { tab_id: tabIdSchema },
    },
    ({ tab_id }) => withSnapshot(tab_id, findDuplicates),
  );

  server.registerTool(
    "get_state",
    {
      description:
        "Inspect the running app's redux state. Give `path` for an exact value, `query` to search paths/values, or neither for a top-level summary.",
      inputSchema: {
        path: z.string().optional().describe("Exact state path, e.g. productState.product.prices[0].value"),
        query: z.string().optional().describe("Free-text search over state paths and values"),
        tab_id: tabIdSchema,
      },
    },
    ({ path, query, tab_id }) => withSnapshot(tab_id, (snapshot) => formatState(snapshot, { path, query })),
  );

  server.registerTool(
    "get_action_log",
    {
      description:
        "Recent redux actions on the running page with what each changed in state (deep diff paths).",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Max actions to return (default 20)"),
        tab_id: tabIdSchema,
      },
    },
    ({ limit, tab_id }) => withSnapshot(tab_id, (snapshot) => formatActionLog(snapshot, limit)),
  );

  server.registerTool(
    "list_tabs",
    {
      description: "List browser tabs currently connected to sentinel-mcp.",
      inputSchema: {},
    },
    () => {
      const tabs = bridge.registry.list();
      if (tabs.length === 0) {
        return text("No tabs connected. Open the app locally with sentinel enabled (sentinelEnabled + mcp prop).");
      }
      return text(
        tabs
          .map(
            (tab) =>
              `${tab.active ? "* " : "  "}${tab.tabId}  ${tab.url}  "${tab.title}"  connected ${formatTime(tab.connectedAt)}`,
          )
          .join("\n"),
      );
    },
  );

  return server;
};
```

- [ ] **Step 4: cli.ts (Task 6 placeholder'ını değiştir) + index.ts**

```ts
#!/usr/bin/env node
// packages/sentinel-mcp/src/cli.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BridgeServer } from "./bridgeServer";
import { createServer } from "./server";

// stdout MCP protokolüne ait — insan çıktısı daima stderr'e.
const port = Number(process.env.SENTINEL_MCP_PORT ?? 8790);
const bridge = new BridgeServer(port);

try {
  await bridge.ready();
} catch (error) {
  console.error(
    `[sentinel-mcp] WebSocket server failed to start on port ${port}: ${
      error instanceof Error ? error.message : String(error)
    }. Set SENTINEL_MCP_PORT to use another port.`,
  );
  process.exit(1);
}

const server = createServer(bridge);
await server.connect(new StdioServerTransport());
console.error(`[sentinel-mcp] ready — MCP on stdio, browser bridge on ws://localhost:${port}`);
```

```ts
// packages/sentinel-mcp/src/index.ts
export { TabRegistry } from "./tabRegistry";
export type { TabInfo } from "./tabRegistry";
export { BridgeServer, NO_TAB_MESSAGE } from "./bridgeServer";
export { createServer } from "./server";
export type { SnapshotSource } from "./server";
```

- [ ] **Step 5: PASS + build doğrula**

Run: `cd packages/sentinel-mcp && npx vitest run && npm run build && head -1 dist/cli.js`
Expected: tüm testler PASS; `dist/cli.js` ilk satırı `#!/usr/bin/env node`.

- [ ] **Step 6: Commit**

```bash
cd /Users/orhanfhb/Projects/sentinel
git add packages/sentinel-mcp/src/
git commit -m "feat: mcp server exposing sentinel tools over stdio"
```

---

### Task 10: Sürüm bump + storefront-main entegrasyonu

**Files (sentinel repo):**
- Modify: `packages/sentinel/package.json` (`1.0.60` → `1.0.61`)

**Files (storefront-main repo — `/Users/orhanfhb/Projects/storefront-main`, branch `sentinel`):**
- Modify: `src/conf/local.conf.js`
- Modify: `src/client/clientDesktop.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `SentinelProvider`'ın `mcp` prop'u (Task 5).

- [ ] **Step 1: Sentinel sürüm bump + publish**

```bash
cd /Users/orhanfhb/Projects/sentinel
# packages/sentinel/package.json → "version": "1.0.61"
# packages/sentinel-mcp/package.json → "@sentinel-core/sentinel": "^1.0.61" (publish öncesi pin)
git add packages/sentinel/package.json packages/sentinel-mcp/package.json
git commit -m "chore: bump sentinel to 1.0.61 and pin mcp dependency"
npm publish --workspace=packages/sentinel
npm publish --workspace=packages/sentinel-mcp
```

Not: registry'ye publish etmeden lokal test için alternatif: storefront'ta `"@sentinel-core/sentinel": "file:../sentinel/packages/sentinel"` geçici referansı (commit'leme).

- [ ] **Step 2: storefront-main değişiklikleri**

`src/conf/local.conf.js` — `sentinelEnabled: true` satırının altına:

```js
  sentinelEnabled: true,
  sentinelMcpUrl: 'ws://localhost:8790'
```

`src/client/clientDesktop.js` — `SentinelProvider`'a prop ekle:

```jsx
        <SentinelProvider
          store={reduxStore}
          sagaMonitor={sentinelMonitor}
          reduxMiddleware={sentinelReduxMiddleware}
          serverState={window.__SENTINEL__?.state}
          serverSagaEffects={window.__SENTINEL__?.sagaEffects}
          serverActionLog={window.__SENTINEL__?.actionLog}
          mcp={config.sentinelMcpUrl ? {url: config.sentinelMcpUrl} : undefined}
          externalLinks={[voltranExternalLink({baseUrl: config.voltranUrl, preview: true})]}>
```

`package.json` — `"@sentinel-core/sentinel": "1.0.61"`.

```bash
cd /Users/orhanfhb/Projects/storefront-main && yarn install
```

- [ ] **Step 3: Manuel doğrulama**

```bash
# Terminal 1: MCP process'i elle başlat (WS tarafını test için)
node /Users/orhanfhb/Projects/sentinel/packages/sentinel-mcp/dist/cli.js
# stderr: "[sentinel-mcp] ready — ... ws://localhost:8790"

# Terminal 2: storefront dev
cd /Users/orhanfhb/Projects/storefront-main && yarn start
```

Tarayıcıda desktop sayfası aç; MCP process stderr'inde hata olmamalı. Doğrulama: DevTools → Network → WS sekmesinde `localhost:8790` bağlantısı OPEN.

- [ ] **Step 4: Commit (storefront-main, JIRA formatıyla)**

```bash
cd /Users/orhanfhb/Projects/storefront-main
git add src/conf/local.conf.js src/client/clientDesktop.js package.json yarn.lock
git commit -m "feat: STO-XXX sentinel mcp bridge integration"
```

Not: `STO-XXX` yerine gerçek JIRA numarası kullanılmalı — commit'ten önce kullanıcıya sor.

---

### Task 11: Uçtan uca doğrulama (Claude Code ile)

**Files:** yok — manuel doğrulama.

- [ ] **Step 1: MCP'yi Claude Code'a kaydet**

```bash
claude mcp add sentinel -- node /Users/orhanfhb/Projects/sentinel/packages/sentinel-mcp/dist/cli.js
# publish sonrası hedef: claude mcp add sentinel -- npx @sentinel-core/mcp
```

- [ ] **Step 2: Senaryoyu çalıştır**

1. `yarn start` ile storefront'u aç, bir ürün sayfasına git.
2. Claude Code'da yeni oturum: `/mcp` ile `sentinel` server'ın bağlı olduğunu gör.
3. Sırasıyla dene ve çıktı doğrula:
   - `list_tabs` → açık sekme listelenir, aktif işaretli
   - `list_api_calls` → sayfanın istekleri (server + client origin)
   - `get_duplicates` → varsa double-fetch uyarısı
   - `get_state` (argümansız) → top-level reducer key'leri
   - `get_lineage` query `"price"` → `state path ← action ← API` zinciri
4. Sekmeyi kapat, `get_state` çağır → "No browser tab connected" mesajı.

- [ ] **Step 3: Sonuçları not et**

Beklenmedik davranışları (boş lineage, eksik effect, yavaş snapshot) `docs/mcp-design.md`'nin sonuna "Bilinen sınırlar" bölümü olarak ekle ve commit et:

```bash
cd /Users/orhanfhb/Projects/sentinel
git add docs/mcp-design.md
git commit -m "docs: known limits from first end-to-end mcp run"
```
