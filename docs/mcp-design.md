# Sentinel MCP — Tasarım Spesifikasyonu

> Durum: Tasarım onaylandı — implementasyon planı bekleniyor.
> Tarih: Temmuz 2026
> Öncülü: [mcp-vision.md](./mcp-vision.md)

## Özet

Sentinel'in topladığı runtime verisini (saga effect'leri, API çağrıları, redux action log'u,
state snapshot'ları) bir MCP server üzerinden Claude Code gibi coding agent'lara tool olarak
açan sistemin onaylanmış tasarımı. Vizyon dokümanındaki açık sorular şu kararlarla kapatıldı:

| Açık soru | Karar |
|---|---|
| Snapshot ne zaman gönderilir? | **Pull** — tool çağrısı geldiğinde process tarayıcıdan taze snapshot ister |
| `get_lineage` componentProps olmadan nasıl çalışır? | **Ters lineage** — yeni `buildLineageFromQuery`: state → action → API |
| Birden çok sekme? | **Son aktif sekme** varsayılan + `list_tabs` tool'u + opsiyonel `tab_id` parametresi |
| Paket yapısı? | **Monorepo üçüncü workspace**: `packages/sentinel-mcp` (`@sentinel-core/mcp`) |
| Komponent registry publish edilsin mi? | **Faz 2** — ilk sürüm kapsam dışı |

## Mimari

```
┌─ Tarayıcı (storefront) ─────────┐      ┌─ sentinel-mcp process ──────┐      ┌─ IDE ─┐
│ SentinelProvider                │  WS  │ WebSocket server :8790      │stdio │Claude │
│  └─ bridge modülü ──────────────┼──────┼─ tab registry (aktif sekme) │──────│ Code  │
│     • bağlan + reconnect        │      │ MCP server (stdio)          │      └───────┘
│     • focus → "aktifim" sinyali │      │  └─ tool çağrısı geldiğinde │
│     • "snapshot ver" → cevapla  │      │     aktif sekmeden PULL     │
└─────────────────────────────────┘      └─────────────────────────────┘
```

### sentinel-mcp process (`packages/sentinel-mcp`)

Tek Node process, iki sunucu:

- **MCP server (stdio)** — `@modelcontextprotocol/sdk` ile; Claude Code process'i başlatır.
  Kurulum: `claude mcp add sentinel -- npx @sentinel-core/mcp`
- **WebSocket server (`localhost:8790`)** — tarayıcı bağlantılarını kabul eder.
  Port `SENTINEL_MCP_PORT` env değişkeni ile override edilebilir.

Process **snapshot tutmaz** — pull modeli: bir MCP tool çağrısı geldiğinde aktif sekmeye
`snapshot-request` mesajı gönderir, cevabı bekler (3 sn timeout), sentinel'in deterministik
fonksiyonlarını o snapshot üzerinde çalıştırıp sonucu döner.

### Tab registry

- Her tarayıcı bağlantısı `register` mesajıyla kayıt olur: `{tabId, url, title}`.
- Tarayıcı `visibilitychange`/`focus` olaylarında `active` sinyali gönderir; registry son
  aktif sekmeyi işaretler.
- `tab_id` parametresi verilmeyen tool çağrıları son aktif sekmeye gider.

### Bridge modülü (`packages/sentinel/src/bridge/`)

`SentinelProvider`'a yeni opsiyonel prop: `mcp?: { url?: string }` (default `ws://localhost:8790`).
Prop verilmezse bridge hiç kurulmaz — mevcut davranışa sıfır etki.

Bridge sorumluluğu:

1. WS'e bağlan; kopunca exponential backoff ile sessiz reconnect (1s → 2s → 4s → max 30s).
   Console'a spam yapmaz, sayfa performansını etkilemez.
2. `register` + aktiflik sinyalleri.
3. `snapshot-request` geldiğinde **mevcut serileştiricilerle** cevapla:

```ts
type Snapshot = {
  tabId: string;
  url: string;
  title: string;
  timestamp: number;
  state: unknown;                    // store.getState()
  serverState?: unknown;             // window.__SENTINEL__ (SSR handoff)
  clientEffects: EffectRecord[];     // sagaMonitor._getSerializableEffects()
  serverEffects?: EffectRecord[];    // provider'a verilen serverSagaEffects
  clientActions: ActionRecord[];     // reduxMiddleware._getSerializableRecords()
  serverActions?: ActionRecord[];    // provider'a verilen serverActionLog
};
```

Snapshot şekli SSR handoff'undaki `window.__SENTINEL__` ile aynı aileden — yeni serileştirme
yazılmaz, mevcut kapaklar (effects max 100, actions max 50, diff max 60) aynen geçerlidir.
Client + server verisi birlikte taşınır; tool'lar origin (`client`/`server`) ayrımı yapar.

### Bundle etkisi

Bridge kodu `@sentinel-core/sentinel` içinde yaşar; storefront'ta `sentinelEnabled=false`
build'lerde `sentinelWebpackPlugin` paketi boş modüle çözümlediği için bridge de otomatik
dışarıda kalır. "Bundle exclusion when disabled" kısıtına ek iş gerektirmeden uyar.

## Tool seti

Hesaplama fonksiyonları `packages/sentinel`'den export edilir (UI ile aynı deterministik kod,
iki tüketici). Her tool opsiyonel `tab_id` alır; verilmezse son aktif sekme.

### `get_lineage(query, tab_id?)`

**Yeni fonksiyon:** `buildLineageFromQuery` — `packages/sentinel/src/utils/lineage.ts`'e
eklenir ve export edilir. Mevcut `buildLineage` komponent-props-merkezlidir; MCP senaryosunda
tıklanan komponent olmadığı için ters yönlü varyant gerekir:

1. **State'te ara** — sorgu iki şekilde eşleşir:
   - **Path segmenti**: state path'i sorguyu içeriyorsa (`"price"` →
     `productState.product.prices[0].value`)
   - **Normalize değer**: `normalize()` kurallarıyla değer eşleşmesi (`"1.299"` → o değeri
     taşıyan path'ler)
   Mevcut `searchState`'in path-match destekli bir varyantı; `MAX_STATE_NODES` /
   `MAX_STATE_DEPTH` kapakları korunur.
2. **Action'ı bul** — her state path için `findActionForStatePath` (mevcut, değişmez):
   diff-prefix derinliği + payload değer kanıtı + recency.
3. **API call'u bul** — `findApiCallForAction` (mevcut): action type'ın PUT effect'i, saga
   ağacında en yakın ortak atayı paylaşan çağrı.

Çıktı örneği:

```
state.productState.product.prices[0].value = 1299.00
  ← GET_PRODUCT_FULFILLED (client, 14:02:31)
  ← GET https://.../productDetail (200, 340ms)
```

### `list_api_calls(tab_id?)`

`extractApiCalls(clientEffects) + extractApiCalls(serverEffects)` → kompakt liste:
`method, url, status, duration, origin, startedAt, errorMessage`. Response body'ler dahil
edilmez (token maliyeti); detay çağrısı faz 2.

### `get_duplicates(tab_id?)`

API çağrılarını `method + normalize(url)` ile gruplar, `count > 1` olanları origin
kırılımıyla döner. Hem server'da hem client'ta yapılan aynı çağrı (double-fetch) ayrıca
işaretlenir.

### `get_state(path?, query?, tab_id?)`

- `path` verilirse: o path'teki değer (derinlik/boyut kapaklı truncate).
- `query` verilirse: `searchState` ile değer/path araması, eşleşen path listesi + preview.
- İkisi de yoksa: top-level reducer key'leri + özet boyutları (tüm state dump edilmez).

### `get_action_log(limit?, tab_id?)`

Son N action: `type, timestamp, diff özetleri (path + type)`. Diff `prev/next` değerleri
preview olarak kısaltılır.

### `list_tabs()`

Bağlı sekmeler: `tab_id, url, title, aktif mi, son görülme zamanı`.

### Kapsam dışı (faz 2)

- `get_component_props` / komponent registry publish (wrapper verisi şu an sadece tıklama
  anında toplanıyor; sürekli toplama ayrı tasarım gerektirir)
- API response body detay tool'u
- `buildCurl` ile "curl olarak ver"

## Storefront entegrasyonu

Üç dosya, minimal değişiklik:

1. **`src/conf/local.conf.js`** — `sentinelMcpUrl: 'ws://localhost:8790'`.
   Sadece local conf; diğer ortam conf'larına eklenmez.
2. **`src/client/clientDesktop.js`** — `SentinelProvider`'a tek prop:
   `mcp={config.sentinelMcpUrl ? {url: config.sentinelMcpUrl} : undefined}`
3. **`package.json`** — `@sentinel-core/sentinel` sürüm bump'ı.

Server tarafında değişiklik yok (SSR verisi zaten provider'da). Mobile kapsam dışı —
mevcut entegrasyon desktop'la sınırlı, MCP de öyle kalır.

## Hata yönetimi

| Durum | Davranış |
|---|---|
| Hiç sekme bağlı değil | Tool açık mesaj döner: "No browser tab connected. Open the app locally with sentinel enabled." |
| Snapshot cevabı gecikirse | 3 sn timeout → "Tab did not respond" + `list_tabs` önerisi |
| WS koptu (tarayıcı) | Exponential backoff ile sessiz reconnect; console spam yok |
| Port çakışması | Process stderr'e net hata + `SENTINEL_MCP_PORT` env override |
| Snapshot çok büyük | Mevcut serileştirme kapakları + tool cevaplarında path bazlı truncate |
| `mcp` prop'u verilmemiş | Bridge hiç kurulmaz — sıfır etki |

## Test stratejisi

- **`buildLineageFromQuery` unit testleri** (sentinel paketi) — asıl yeni deterministik
  mantık: path-match, değer-match, action seçimi, saga-API zinciri; sentetik effect/action
  fixture'larıyla.
- **Bridge protokol testleri** — mock WebSocket: register → snapshot-request →
  snapshot-response el sıkışması, reconnect, aktiflik sinyali.
- **MCP server entegrasyon testi** — SDK'nın in-memory transport'u ile tool çağrısı →
  sahte sekme → cevap doğrulama; gerçek WS + stdio smoke testi.
- **Uçtan uca manuel doğrulama** — `playground-webpack` + `claude mcp add sentinel` ile
  vizyon senaryosu: "fiyat nereden geliyor?" sorusuna gerçek lineage cevabı.

## Efor

| Parça | Süre |
|---|---|
| MCP server kabuğu + tool'lar | 1-2 gün |
| Bridge + snapshot protokolü | 2-3 gün |
| `buildLineageFromQuery` | 1 gün |
| Uçtan uca test/cila | 1 gün |
| **Toplam** | **~1 hafta** |

## İlgili mevcut altyapı

- `packages/sentinel/src/utils/lineage.ts` — `buildLineage`, `searchState`,
  `findActionForStatePath`, `findApiCallForAction`
- `packages/sentinel/src/utils/apiCalls.ts` — `extractApiCalls`, `correlateProps`, `normalize`
- `packages/sentinel/src/saga/createSentinelSagaMonitor.ts` — `_getSerializableEffects`
- `packages/sentinel/src/redux/createSentinelReduxMiddleware.ts` — `_getSerializableRecords`
- `packages/sentinel/src/react/provider.tsx` — `mcp` prop'unun ekleneceği yer
