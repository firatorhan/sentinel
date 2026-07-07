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

  it("sends active signal when the tab becomes visible", () => {
    const bridge = create();
    const ws = MockWebSocket.instances[0];
    ws.open();
    const before = ws.messages().filter((m) => m.kind === "active").length;
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(ws.messages().filter((m) => m.kind === "active").length).toBeGreaterThan(before);
    bridge.dispose();
  });
});
