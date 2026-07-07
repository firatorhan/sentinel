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
