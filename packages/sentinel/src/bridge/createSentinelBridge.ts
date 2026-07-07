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
