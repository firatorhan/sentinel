# @sentinel-core/mcp

MCP server that exposes [sentinel](https://github.com/firatorhan/sentinel)'s runtime data —
API calls, Redux state, action log, value lineage — to MCP-speaking coding agents
(Claude Code, Cursor, …). The agent that writes your code can also *see your running page*.

```
Browser (sentinel) ──WebSocket──▶ sentinel-mcp process ──stdio──▶ Claude Code
   effects, state,                  pulls a fresh snapshot
   actionLog, lineage               per tool call
```

## Setup

**1. Register the server with your agent:**

```bash
claude mcp add sentinel -- npx @sentinel-core/mcp
```

**2. Enable the bridge in your app** (requires `@sentinel-core/sentinel` ≥ 1.0.61):

```jsx
import { SentinelProvider } from "@sentinel-core/sentinel";

<SentinelProvider store={store} sagaMonitor={monitor} mcp={{ url: "ws://localhost:8790" }}>
  <App />
</SentinelProvider>
```

The bridge connects to the MCP process over WebSocket, reconnects silently with backoff,
and answers snapshot requests on demand. No `mcp` prop → no bridge, zero impact.

**3. Open your app locally**, start a new agent session and ask:
*"where does this price value come from?"*

```
productState.product.prices[0].value = 1299
  ← GET_PRODUCT_FULFILLED (client, 14:02:31)
  ← GET https://…/productDetail (200, 340ms, client)
```

## Tools

| Tool | Answers |
|---|---|
| `get_lineage(query, tab_id?)` | Where does this value come from? Query matches state paths (`"price"`) and values (`"1299"`); returns `state path ← redux action ← API request` chains |
| `list_api_calls(tab_id?)` | Every request the page made (SSR + client) with method, URL, status, duration, origin |
| `get_duplicates(tab_id?)` | Requests issued more than once, incl. server+client double-fetches |
| `get_state(path?, query?, tab_id?)` | Exact value at a path, free-text search, or top-level summary |
| `get_action_log(limit?, tab_id?)` | Recent redux actions with deep-diff paths of what they changed |
| `get_component_props(name?, tab_id?)` | Props a React component actually received. `name` lists every instance of that component with its current props + render count; omit `name` to list all captured components. Sees props that never touch redux (local/computed/context) |
| `list_tabs()` | Connected browser tabs; the last active tab is the default target |

All tools accept an optional `tab_id` (from `list_tabs`); without it the last active tab is used.

## Configuration

| | |
|---|---|
| Port | `8790` by default — override with `SENTINEL_MCP_PORT` |
| Binding | `127.0.0.1` only — snapshots never leave your machine |
| Snapshot timeout | 3s per tool call; clear error message when no tab is connected |

## How it works

The process holds no state: each tool call pulls a fresh snapshot (Redux state, serialized
saga effects, action log — both SSR and client origin) from the active browser tab, then runs
sentinel's deterministic analysis functions (`buildLineageFromQuery`, `extractApiCalls`, …)
on it. No AI calls, no API keys, everything local.

## License

MIT
