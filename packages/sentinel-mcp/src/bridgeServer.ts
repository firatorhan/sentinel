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
