# @sentinel-core/sentinel

Runtime intelligence for your React UI — hover to inspect, click to deep-dive into props, Redux state, and Saga effects.

## Installation

```bash
npm install @sentinel-core/sentinel
```

Import the CSS in your client entry point:

```js
import "@sentinel-core/sentinel/index.css";
```

## Usage

Wrap your app with `SentinelProvider` in the **client entry point only** (never server-side):

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

Toggle the toolbar with the floating button (bottom-right) or `Ctrl+Shift+S`.

## SentinelProvider Props

| Prop | Type | Description |
|---|---|---|
| `store` | `ReduxStore` | Redux store for live state inspection |
| `sagaMonitor` | `SentinelSagaMonitor` | Saga monitor from `createSentinelSagaMonitor()` |
| `reduxMiddleware` | `SentinelReduxMiddleware` | Action log middleware from `createSentinelReduxMiddleware()` |
| `serverState` | `unknown` | Server-side Redux state snapshot (SSR) |
| `serverSagaEffects` | `EffectRecord[]` | Server-side saga effects (SSR) |
| `serverActionLog` | `ActionRecord[]` | Server-side action log (SSR) |
| `externalLinks` | `ExternalLink[]` | Deep-link buttons shown in the component dialog header |

## Redux Integration

```jsx
import { SentinelProvider } from "@sentinel-core/sentinel";

<SentinelProvider store={reduxStore}>
  <App />
</SentinelProvider>
```

Pass `serverState` for SSR apps to show a Client/Server toggle in the State tab:

```jsx
<SentinelProvider store={reduxStore} serverState={window.__INITIAL_STATE__}>
  <App />
</SentinelProvider>
```

## Action Log

Record dispatched actions with top-level state diffs in the toolbar's **Log** tab:

```js
import { createSentinelReduxMiddleware } from "@sentinel-core/sentinel";

const sentinelMiddleware = createSentinelReduxMiddleware(); // options: { maxRecords } (default 50)
const store = createStore(reducer, applyMiddleware(sentinelMiddleware.middleware));
```

```jsx
<SentinelProvider store={store} reduxMiddleware={sentinelMiddleware}>
  <App />
</SentinelProvider>
```

Framework actions (`@@…`, `persist/…`) are hidden by default behind a **System** toggle, and consecutive duplicates collapse into a single grouped row.

## Saga Integration

```js
import { createSentinelSagaMonitor } from "@sentinel-core/sentinel";

const sagaMonitor = createSentinelSagaMonitor(); // options: { maxRecords } (default 100)
const sagaMiddleware = createSagaMiddleware({ sagaMonitor });

// Pass to both the middleware and the provider
```

```jsx
<SentinelProvider sagaMonitor={sagaMonitor}>
  <App />
</SentinelProvider>
```

Supports redux-saga v1.x and v0.x.

The Saga tab shows CALL effects by default; TAKE/FORK/PUT plumbing is one click away via the type filters.

## API Layer

With a saga monitor connected, clicking a component shows an **API Layer** tab in the dialog:

- Lists HTTP calls extracted from saga effects — both Axios responses and rejections (rejected calls keep their status code and request config)
- Filters to the requests whose response data matches the clicked component's props; a **Props match / All** toggle switches views
- A collapsed **props mapping** accordion traces each prop to the response field it came from (`price ← variants[0].price`), and matched fields are highlighted (and auto-expanded) in the response tree
- **Copy as cURL** rebuilds the request with method, URL, headers, and body

Server-side calls from `serverSagaEffects` are included and tagged with a `server` badge.

## External Links

`externalLinks` lets you add custom deep-link buttons to the component dialog header. When a component is clicked, matching links are resolved and shown.

```jsx
import { SentinelProvider } from "@sentinel-core/sentinel";

<SentinelProvider
  externalLinks={[
    {
      label: "Open in Storybook",
      match: (componentName) => storybookComponents.includes(componentName),
      url: (props) => `https://storybook.example.com/?path=/story/${props.id}`,
    },
  ]}
>
  <App />
</SentinelProvider>
```

### `ExternalLink` type

```ts
type ExternalLink = {
  match: (componentName: string, props: Record<string, any>) => boolean;
  url: (props: Record<string, any>, sagaEffects: EffectRecord[]) => string;
  label: string;
};
```

## Voltran MFE Integration

Use the built-in `voltranExternalLink` helper to deep-link to Voltran microfrontend components. It resolves the URL automatically from `getFragments` saga effects.

```jsx
import { SentinelProvider, voltranExternalLink } from "@sentinel-core/sentinel";

<SentinelProvider
  sagaMonitor={sagaMonitor}
  serverSagaEffects={serverSagaEffects}
  externalLinks={[
    voltranExternalLink({
      label: "Open in Voltran",         // optional, default: "Open in Microfrontend"
      baseUrl: "https://voltran.example.com", // optional, for relative fragment paths
      preview: true,                    // optional, appends ?preview to the URL
    }),
  ]}
>
  <App />
</SentinelProvider>
```

The helper matches any component with a `fragmentInfo.id` prop and resolves the URL from the `getFragments` saga call's result (client) or config (server).

## SSR

Pass server-side data to show Client/Server tabs in the toolbar:

```jsx
// server entry — collect saga effects and the action log
const sagaMonitor = createSentinelSagaMonitor();
const sentinelMiddleware = createSentinelReduxMiddleware();
await store.dispatch(runSagas());
const serverSagaEffects = sagaMonitor._getSerializableEffects();
const serverActionLog = sentinelMiddleware._getSerializableRecords();

// send to client via window.__SENTINEL__ or similar

// client entry
<SentinelProvider
  store={store}
  sagaMonitor={clientSagaMonitor}
  reduxMiddleware={clientSentinelMiddleware}
  serverState={window.__SENTINEL__.state}
  serverSagaEffects={window.__SENTINEL__.sagaEffects}
  serverActionLog={window.__SENTINEL__.actionLog}
>
  <App />
</SentinelProvider>
```

## Plugin

Use [`@sentinel-core/sentinel-plugin`](https://www.npmjs.com/package/@sentinel-core/sentinel-plugin) to automatically wrap your components at build time — no manual `<Sentinel>` wrapper needed.

## Webpack

Add `conditionNames` to your resolve config:

```js
resolve: {
  conditionNames: ["require", "default"],
}
```

## License

MIT
