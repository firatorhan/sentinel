# @sentinel-core/sentinel-plugin

Build-time plugin for [`@sentinel-core/sentinel`](https://www.npmjs.com/package/@sentinel-core/sentinel). Automatically wraps React components with the `<Sentinel>` inspector at build time — no manual changes to your component files needed.

Supports Vite, Webpack, Rollup, and esbuild via [unplugin](https://github.com/unjs/unplugin).

## Installation

```bash
npm install -D @sentinel-core/sentinel-plugin
```

## Vite

```js
// vite.config.js
import { sentinelVitePlugin } from "@sentinel-core/sentinel-plugin";

export default {
  plugins: [
    sentinelVitePlugin({
      include: ["src/components/**/*.tsx"],
    }),
    react(),
  ],
};
```

## Webpack

Add to `webpack.client.js` only (not server):

```js
const { sentinelWebpackPlugin } = require("@sentinel-core/sentinel-plugin");

module.exports = {
  plugins: [
    sentinelWebpackPlugin({
      include: ["src/blocks/**/*.jsx"],
    }),
  ],
  resolve: {
    conditionNames: ["require", "default"],
  },
  module: {
    rules: [
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
    ],
  },
};
```

## Rollup

```js
import { sentinelRollupPlugin } from "@sentinel-core/sentinel-plugin";

export default {
  plugins: [
    sentinelRollupPlugin({
      include: ["src/**/*.tsx"],
    }),
  ],
};
```

## esbuild

```js
import { sentinelEsbuildPlugin } from "@sentinel-core/sentinel-plugin";

build({
  plugins: [
    sentinelEsbuildPlugin({
      include: ["src/**/*.tsx"],
    }),
  ],
});
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `include` | `string[]` | `["**/*.tsx", "**/*.jsx"]` | Glob patterns of files to transform |
| `exclude` | `string[]` | `[]` | Glob patterns of files to skip |

`.js` files are not included by default — add `"**/*.js"` to `include` if needed.

## How It Works

The plugin transforms your source files at build time using Babel AST:

1. **Detects React components** — PascalCase function declarations, arrow functions, function expressions, and class components with a `render()` method. Skips `async` functions.
2. **Wraps render output** — Rewrites each component's return to `<Sentinel componentProps={props}>...</Sentinel>`.
3. **Injects imports** — Adds `import { Sentinel } from "@sentinel-core/sentinel"` automatically.
4. **Tracks render count** — Injects a `useRef` counter for function components, `this._sentinel_rc` for class components.
5. **Auto-imports `.md` docs** — If `Foo.md` exists next to `Foo.jsx`, it's imported as a raw string and passed as `dialogMd` to the Sentinel wrapper. Shown in the dialog's `.md` tab.

## Comment Directives

### Skip an entire file

Place `// @sentinel-ignore` as the first non-empty line:

```jsx
// @sentinel-ignore
export function InternalHelper() { ... }
```

### Skip a single component

Place `// @sentinel-ignore` on the line above the component declaration:

```jsx
// @sentinel-ignore
export function DebugOverlay() { ... }

export function ProductCard() { ... } // ← still instrumented
```

### Force-include a component outside `include` globs

Place `// @sentinel-watch` on the line above:

```jsx
// @sentinel-watch
export function LazyLoadedWidget() { ... }
```

## `.md` Documentation Convention

If a component file has a sibling Markdown file with the same name, its content is shown in the Sentinel dialog when the component is clicked:

```
src/
  components/
    ProductCard.tsx
    ProductCard.md   ← rendered in the .md tab
```

## License

MIT
