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
| `serverState` | `unknown` | Server-side Redux state snapshot (SSR) |
| `serverSagaEffects` | `EffectRecord[]` | Server-side saga effects (SSR) |
| `externalLinks` | `ExternalLink[]` | Deep-link buttons shown in the component dialog header |

## Redux Integration

```jsx
import { SentinelProvider } from "@sentinel-core/sentinel";

<SentinelProvider store={reduxStore}>
  <App />
</SentinelProvider>
```

Pass `serverState` for SSR apps to show a Client/Server toggle in the Redux tab:

```jsx
<SentinelProvider store={reduxStore} serverState={window.__INITIAL_STATE__}>
  <App />
</SentinelProvider>
```

## Saga Integration

```js
import { createSentinelSagaMonitor } from "@sentinel-core/sentinel";

const sagaMonitor = createSentinelSagaMonitor();
const sagaMiddleware = createSagaMiddleware({ sagaMonitor });

// Pass to both the middleware and the provider
```

```jsx
<SentinelProvider sagaMonitor={sagaMonitor}>
  <App />
</SentinelProvider>
```

Supports redux-saga v1.x and v0.x.

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
// server entry — collect saga effects
const sagaMonitor = createSentinelSagaMonitor();
await store.dispatch(runSagas());
const serverSagaEffects = sagaMonitor._getSerializableEffects();

// send to client via window.__SENTINEL__ or similar

// client entry
<SentinelProvider
  store={store}
  sagaMonitor={clientSagaMonitor}
  serverState={window.__SENTINEL__.state}
  serverSagaEffects={window.__SENTINEL__.sagaEffects}
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
