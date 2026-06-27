# Sentinel

Runtime intelligence for React UIs. Hover over any component to inspect it, click to explore its props, Redux state, and Saga effects — without touching your source code.

## Packages

| Package | Version | Description |
|---|---|---|
| [`@sentinel-core/sentinel`](./packages/sentinel) | [![npm](https://img.shields.io/npm/v/@sentinel-core/sentinel)](https://www.npmjs.com/package/@sentinel-core/sentinel) | React provider + toolbar UI |
| [`@sentinel-core/sentinel-plugin`](./packages/sentinel-plugin) | [![npm](https://img.shields.io/npm/v/@sentinel-core/sentinel-plugin)](https://www.npmjs.com/package/@sentinel-core/sentinel-plugin) | Vite / Webpack / Rollup / esbuild build plugin |

## Quick Start

```bash
npm install @sentinel-core/sentinel
npm install -D @sentinel-core/sentinel-plugin
```

**1. Add the plugin to your bundler config:**

```js
// vite.config.js
import { sentinelVitePlugin } from "@sentinel-core/sentinel-plugin";

export default {
  plugins: [sentinelVitePlugin({ include: ["src/**/*.tsx"] }), react()],
};
```

**2. Wrap your app with `SentinelProvider`:**

```jsx
import { SentinelProvider } from "@sentinel-core/sentinel";
import "@sentinel-core/sentinel/index.css";

function ClientApp() {
  return (
    <SentinelProvider>
      <App />
    </SentinelProvider>
  );
}
```

**3. Open the toolbar** — click the `ScanEye` button (bottom-right) or press `Ctrl+Shift+S`.

## Features

- **Component inspector** — hover to highlight, click to open a dialog with props, render count, and source link
- **Props history** — last 6 prop snapshots with accordion diff view
- **Redux tab** — live state tree with deep search, Client/Server toggle for SSR
- **Saga tab** — effect call list with deep search across args/result/error, status indicators
- **External links** — configurable deep-links in the dialog header (e.g. open a Voltran MFE)
- **`.md` docs** — place a `Foo.md` next to `Foo.jsx` to show component docs in the dialog

## Monorepo

This is an npm workspace monorepo.

```
packages/
  sentinel/         → @sentinel-core/sentinel
  sentinel-plugin/  → @sentinel-core/sentinel-plugin
playground/         → Vite + React 19 (not a workspace member)
playground-webpack/ → Webpack 5 + Express
```

```bash
# Build everything
npm run build

# Run webpack playground (http://localhost:3000)
npm run dev

# Run Vite playground (http://localhost:5173)
cd playground && npm install && npm run dev
```

## License

MIT
