# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

```bash
# Build both packages (sentinel first, then sentinel-plugin)
npm run build

# Build individual packages
npm run build --workspace=packages/sentinel
npm run build --workspace=packages/sentinel-plugin

# Watch mode for sentinel package
npm run dev --workspace=packages/sentinel

# Run webpack playground (http://localhost:3000)
npm run dev

# Run Vite playground (http://localhost:5173) — not a workspace, run separately
cd playground && npm install && npm run dev

# Clean all node_modules and dist folders
npm run clean

# Lint (run from packages/sentinel)
cd packages/sentinel && npx eslint .
```

There are no tests. The playgrounds (`playground/` for Vite, `playground-webpack/` for Webpack) serve as manual integration environments.

**Build order matters:** `packages/sentinel` must be built before `packages/sentinel-plugin`, and both before the playgrounds can consume them from `node_modules`.

## Architecture

This is an npm workspace monorepo with two publishable packages and two playgrounds. `playground-webpack/` is a workspace member; `playground/` (Vite) is not — it must be installed and run independently.

### Package: `@sentinel-core/sentinel`

A React component library built with Vite in lib mode (ES + CJS). Exposes:
- `SentinelProvider` — context provider that must wrap the app client-side. Renders `Spotlight` (radial gradient overlay via Portal) and `SentinelDialog` (tabbed dialog) internally. **Never render server-side** — it uses `document` via Portal.
- `Sentinel` — wrapper component injected by the plugin. Registers hover/click handlers and tracks render count + prop history (last 6 snapshots via `propHistoryRef`).
- `useSentinelInteraction()` — hover state context (activeId, activeRect, registerHover, unregisterHover, openDialog).
- `useSentinelDialog()` — dialog state context (openDialogId, dialogMeta, closeDialog).
- `useSentinel()` — merged shorthand for the two contexts above; returns noops when called outside a provider.
- CSS must be imported separately: `@sentinel-core/sentinel/index.css`

Uses **classic JSX runtime** (`React.createElement`) — `jsxRuntime: "classic"` in Vite config and `esbuild.jsxFactory: "React.createElement"`. Webpack consumers must set `conditionNames: ["require", "default"]` in resolve config.

#### Internal UI layers (`src/ui/`)
- `ui/components/` — thin wrappers around `@huin-core/*` primitives (Dialog, Tabs, Popover, etc.), styled with Tailwind CSS 4.
- `ui/widgets/` — composite widgets used inside `SentinelDialog`: `MarkdownViewer`, `PropsViewer`, `SentinelDialog`, `Spotlight`.

`SentinelDialog` has four tabs: `.md` (renders the component's markdown doc), `Props Tracker` (current props + history), `API Layer` (stub), `Event Tracker` (stub). The dialog header shows a `vscode://file/...` link to the source file.

### Package: `@sentinel-core/sentinel-plugin`

Built with `tsup`. Exposes four bundler-specific plugins via `unplugin`:
- `sentinelVitePlugin`, `sentinelWebpackPlugin`, `sentinelRollupPlugin`, `sentinelEsbuildPlugin`

**How the plugin works (build-time AST transformation):**

1. **`scanner.ts`** — Traverses each file's AST. Detects React components by PascalCase naming on function declarations, arrow functions, function expressions, and class components (must have a `render()` method). Skips `async` functions. For each component `Foo`, checks if `Foo.md` exists in the same directory — if so, schedules it for import as a raw string (`FooMd`).

2. **`wrapper.ts`** — Rewrites the render output to wrap it in `<Sentinel dialogMd={FooMd} componentProps={props}>`. For function components, uses `React.useRef` to track render count; for class components, uses `this._sentinel_rc`. Injects `import { Sentinel } from "@sentinel-core/sentinel"` and `import * as React from "react"` at the top of the file if not already present.

3. **`transform.ts`** — Orchestrates: parse → scan → inject imports → AST traverse+wrap → generate code. Returns `null` (no-op) if the file contains `// @sentinel-ignore` as the first non-empty line.

The plugin runs `enforce: "pre"` so it transforms code before framework plugins (e.g., Babel, SWC) process JSX. Processes `.tsx`, `.jsx`, and `.js` files; skips `node_modules`.

### `.md` File Convention

If a component file `src/components/Foo.jsx` has a sibling `src/components/Foo.md`, the plugin auto-imports it as a raw string and passes it as `dialogMd` to the `Sentinel` wrapper. This markdown content is rendered in the dialog's `.md` tab when the component is clicked in the UI.

### Comment Directives

- `// @sentinel-ignore` — first non-empty line of a file skips all transformation for that file. Also works on the line above an individual component declaration to skip just that component.
- `// @sentinel-watch` — place on the line above a component declaration to force-include it even if the file is outside the `include` glob pattern.

### Escape Hatches

- In `sentinelVitePlugin`/`sentinelWebpackPlugin` options, use `exclude` to skip specific files (e.g., `["**/*.test.tsx", "**/SomeComponent.tsx"]`).

### Playgrounds

- **`playground/`** — Vite + React 19 + TypeScript. Uses `sentinelVitePlugin`. Not a workspace member — must be run with `cd playground && npm install && npm run dev`.
- **`playground-webpack/`** — Webpack 5 + Express dev server + HMR. Uses `sentinelWebpackPlugin`. React 16 (uses `ReactDOM.render`, not `createRoot`). Entry: `src/index.jsx` → `src/App.jsx` → `src/components/`.

### External Webpack Integration

Add only to `webpack.client.js` (not server):

```js
const { sentinelWebpackPlugin } = require("@sentinel-core/sentinel-plugin");

// In plugins:
sentinelWebpackPlugin({ include: ["src/blocks/**/*.jsx"] })

// In resolve:
{ conditionNames: ["require", "default"] }

// In module.rules (for CSS):
{ test: /\.css$/, use: ["style-loader", "css-loader"] }
```

Wrap `SentinelProvider` in the **client entry point** only (where `hydrateRoot` or `ReactDOM.render` is called), not in the server entry.
