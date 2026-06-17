# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

```bash
# Build both packages (sentinel first, then sentinel-plugin)
npm run build

# Run webpack playground (http://localhost:3000)
npm run dev

# Clean all node_modules and dist folders
npm run clean

# Build individual packages
npm run build --workspace=packages/sentinel
npm run build --workspace=packages/sentinel-plugin

# Lint (run from packages/sentinel)
cd packages/sentinel && npx eslint .
```

There are no tests. The playgrounds (`playground/` for Vite, `playground-webpack/` for Webpack) serve as manual integration environments.

**Build order matters:** `packages/sentinel` must be built before `packages/sentinel-plugin` can be published, and both must be built before the playgrounds can consume them from `node_modules`.

## Architecture

This is an npm workspace monorepo with two publishable packages and two playgrounds.

### Package: `@sentinel-core/sentinel`

A React component library built with Vite in lib mode (ES + CJS). Exposes:
- `SentinelProvider` — context provider that must wrap the app client-side. Renders `Spotlight` (radial gradient overlay via Portal) and `SentinelDialog` (tabbed dialog) internally. **Never render server-side** — it uses `document` via Portal.
- `Sentinel` — wrapper component that registers hover/click handlers. Consumers rarely use this directly; the plugin auto-injects it.
- `useSentinel()` — returns noop context when called outside a provider, so it's safe to call anywhere.
- CSS must be imported separately: `@sentinel-core/sentinel/index.css`

Uses **classic JSX runtime** (`React.createElement`) — `jsxRuntime: "classic"` in Vite config and `esbuild.jsxFactory: "React.createElement"`. Webpack consumers must set `conditionNames: ["require", "default"]` in resolve config.

### Package: `@sentinel-core/sentinel-plugin`

Built with `tsup`. Exposes four bundler-specific plugins via `unplugin`:
- `sentinelVitePlugin`, `sentinelWebpackPlugin`, `sentinelRollupPlugin`, `sentinelEsbuildPlugin`

**How the plugin works (build-time AST transformation):**

1. **`scanner.ts`** — Traverses each file's AST. Detects React components by PascalCase naming convention on function declarations and arrow functions. For each detected component named `Foo`, checks if `Foo.md` exists in the same directory — if so, schedules it for import as a raw string (`FooMd`).

2. **`wrapper.ts`** — Rewrites the component's render function body to wrap its output in `<Sentinel dialogMd={FooMd} componentProps={props}>`. Injects `import { Sentinel } from "@sentinel-core/sentinel"` and `import * as React from "react"` at the top of the file if not already present.

3. **`transform.ts`** — Orchestrates: parse → scan → inject imports → AST traverse+wrap → generate code. Returns `null` (no-op) if the file contains `@sentinel-ignore`.

The plugin runs `enforce: "pre"` so it transforms code before framework plugins (e.g., Babel, SWC) process JSX.

### `.md` File Convention

If a component file `src/components/Foo.jsx` has a sibling `src/components/Foo.md`, the plugin auto-imports it as a raw string and passes it as `dialogMd` to the `Sentinel` wrapper. This markdown content is rendered in the dialog's `.md` tab when the component is clicked in the UI.

### Escape Hatches

- Add `// @sentinel-ignore` anywhere in a file to skip all transformation for that file.
- In `sentinelVitePlugin`/`sentinelWebpackPlugin` options, use `exclude` to skip specific files (e.g., `["**/*.test.tsx", "**/SomeComponent.tsx"]`).

### Playgrounds

- **`playground/`** — Vite + React 19 + TypeScript. Uses `sentinelVitePlugin`. Not part of the npm workspaces (`playground-webpack` is).
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
