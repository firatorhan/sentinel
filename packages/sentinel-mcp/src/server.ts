import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Snapshot } from "@sentinel-core/sentinel/core";
import type { TabInfo } from "./tabRegistry";
import { formatLineage } from "./tools/lineage";
import { listApiCalls, findDuplicates } from "./tools/apiCalls";
import { formatState } from "./tools/state";
import { formatActionLog } from "./tools/actionLog";
import { formatComponents } from "./tools/components";
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
        "Trace where a runtime value comes from in the running app: state path ← redux action ← API request. Query matches state paths (e.g. 'price') and values (e.g. '1299'). Call this when the user asks why a value on the page looks wrong or where it comes from.",
      inputSchema: { query: z.string().min(3).describe("State path segment or value to trace"), tab_id: tabIdSchema },
    },
    ({ query, tab_id }) => withSnapshot(tab_id, (snapshot) => formatLineage(snapshot, query)),
  );

  server.registerTool(
    "list_api_calls",
    {
      description:
        "List every API request the running page made (server-side render + client), with method, URL, status, duration and origin. Call this to see what the page fetched and how long requests took.",
      inputSchema: { tab_id: tabIdSchema },
    },
    ({ tab_id }) => withSnapshot(tab_id, listApiCalls),
  );

  server.registerTool(
    "get_duplicates",
    {
      description:
        "Find API requests issued more than once on the running page, including server+client double-fetches. Call this when investigating wasted or redundant network traffic.",
      inputSchema: { tab_id: tabIdSchema },
    },
    ({ tab_id }) => withSnapshot(tab_id, findDuplicates),
  );

  server.registerTool(
    "get_state",
    {
      description:
        "Inspect the running app's redux state. Give `path` for an exact value, `query` to search paths/values, or neither for a top-level summary. Call this to see what the state actually holds right now.",
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
        "Recent redux actions on the running page with what each changed in state (deep diff paths). Call this to see which action wrote which part of the state.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Max actions to return (default 20)"),
        tab_id: tabIdSchema,
      },
    },
    ({ limit, tab_id }) => withSnapshot(tab_id, (snapshot) => formatActionLog(snapshot, limit)),
  );

  server.registerTool(
    "get_component_props",
    {
      description:
        "Inspect the props a React component actually received on the running page. Give `name` to see every mounted instance of that component with its current props and render count; omit `name` to list all captured components. Call this when redux state looks correct but a component renders wrong, or to see props that never touch redux (local/computed/context props).",
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe("Component name, substring match (e.g. ProductCard)"),
        tab_id: tabIdSchema,
      },
    },
    ({ name, tab_id }) => withSnapshot(tab_id, (snapshot) => formatComponents(snapshot, { name })),
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
