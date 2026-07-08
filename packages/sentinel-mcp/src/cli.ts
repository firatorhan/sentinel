#!/usr/bin/env node
// stdout MCP protokolüne ait — insan çıktısı daima stderr'e.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BridgeServer } from "./bridgeServer";
import { createServer } from "./server";

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

// Bridge'in WebSocket server'ı event loop'u canlı tutar; parent (MCP client)
// ölüp stdin kapandığında süreç kendiliğinden bitmez ve öksüz kalıp portu
// işgal eder. Her kapanma sinyalinde bridge'i kapatıp çıkmak zorundayız.
let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  void bridge.close().finally(() => process.exit(0));
};

process.stdin.on("end", shutdown);
process.stdin.on("close", shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.server.onclose = shutdown;
