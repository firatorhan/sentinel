# Sentinel MCP Vizyonu — "Coding Agent'ının Runtime Gözü"

> Durum: Vizyon / keşif aşaması — henüz implementasyona başlanmadı.
> Tarih: Temmuz 2026

## Özet

Sentinel'in topladığı runtime verisini (saga effect'leri, API çağrıları, redux action log'u,
state snapshot'ları, lineage zincirleri) bir **MCP server** üzerinden IDE'deki coding
agent'lara (Claude Code, Cursor vb.) tool olarak açmak.

Bugün coding agent'ların en büyük körlüğü çalışan uygulamanın içini görememek — statik koda
bakıyorlar. Sentinel tam bu köprü: **"kodunu yazan agent, sayfanı da görsün."**

Bu özellik sentinel'i "React devtool" kategorisinden **"AI-native observability"**
kategorisine taşır.

## MCP nedir?

MCP (Model Context Protocol), Anthropic'in açık protokolü: AI istemcilerinin (Claude Code,
Claude Desktop, Cursor…) dış veri ve araçlara standart şekilde bağlanmasını sağlar —
"AI için USB-C". Bir kez MCP server yazılır, MCP konuşan her istemci ona bağlanabilir.

Bir MCP server özünde küçük bir programdır: istemciye hangi tool'lara sahip olduğunu bildirir,
istemcideki model bir tool'u çağırınca handler'ı çalıştırıp sonucu döndürür. Tool tanımı
sentinel'de zaten kullanılan desenle aynıdır: isim + açıklama + input şeması + fonksiyon.

İki taşıma modu vardır:

- **stdio** — istemci server'ı lokal process olarak başlatır (IDE senaryosu için standart, sentinel için yeterli)
- **HTTP (Streamable)** — uzak server senaryoları için

## Mimari

Asıl tasarım sorusu: sentinel'in verisi **tarayıcıda** yaşıyor (çalışan sayfanın belleği),
MCP server ise IDE'nin başlattığı ayrı bir Node process'i. Aradaki köprü:

```
Tarayıcı (sentinel)  ──WebSocket/HTTP──▶  sentinel-mcp process  ──stdio──▶  Claude Code
   effects, state,                          snapshot tutar,
   actionLog, lineage                       tool'ları sunar
```

Pratik tasarım:

1. **Publish katmanı** — `SentinelProvider`'a küçük bir ekleme: toplanan veriyi (effects,
   actionLog, state snapshot) periyodik ya da istek üzerine `localhost`'taki sentinel-mcp
   process'ine gönderir (WebSocket veya HTTP POST).
2. **sentinel-mcp process** — son snapshot'ı bellekte tutar; MCP tool çağrıları geldiğinde
   sentinel'in **mevcut deterministik fonksiyonlarını** snapshot üzerinde çalıştırır.
3. **IDE entegrasyonu** — tek satır kurulum: `claude mcp add sentinel -- npx @sentinel-core/mcp`

## Tool seti (mevcut kodun üstüne kurulur)

AI katmanı incecik kalır — bugüne kadar yazılan deterministik altyapı tool'a dönüşür:

| MCP tool | Arkasındaki mevcut kod | Cevapladığı soru |
|---|---|---|
| `get_lineage(query)` | `buildLineage` (lineage.ts) | "Bu prop/değer nereden geliyor?" |
| `list_api_calls()` | `extractApiCalls` (apiCalls.ts) | "Sayfa hangi istekleri attı, süreleri ne?" |
| `get_duplicates()` | duplicate sayacı (ApiLayerViewer mantığı) | "Hangi istekler gereksiz tekrarlanıyor?" |
| `get_state(path)` | state snapshot + `searchState` | "State'te şu anda ne var?" |
| `get_action_log()` | middleware kayıtları + deep diff | "Hangi action state'te neyi değiştirdi?" |

## Kullanıcı deneyimi senaryosu

1. Geliştirici storefront'u lokalde açar; sentinel arka planda veri toplar.
2. IDE'de Claude Code'a yazar: *"fiyat yanlış görünüyor, baksana"*
3. Claude Code `get_lineage("price")` çağırır →
   `state.productState.product.prices[0].value ← GET_PRODUCT_FULFILLED ← GET /productDetail`
4. Agent response'taki gerçek değere bakar, koda gider, doğru dosyada düzeltmeyi yapar.

Agent ilk kez **çalışan uygulamanın içini görerek** debug yapar — bugün hiçbir coding
agent'ın tek başına yapamadığı şey.

## Neden bu yol? (stratejik notlar)

- **API key gerektirmiyor.** AI'ı sentinel çağırmıyor; geliştiricinin zaten kullandığı
  Claude Code sentinel'i çağırıyor. Maliyet ve gizlilik derdi olmadan AI-native olmanın
  en zarif yolu.
- **Deterministik katman = AI isabeti.** IDF ağırlıklandırma, lineage tutarlılık kuralları,
  deep diff — bunlara harcanan emek doğrudan agent cevaplarının kalitesini belirler.
  AI katmanı hep deterministik katmanın *üstüne* konur, yerine değil.
- **VPN-only kısıtıyla uyumlu.** Her şey lokal çalışır: tarayıcı → lokal process → IDE.
  Hiçbir veri dışarı çıkmaz.
- **Rakipsiz alan.** Runtime observability → coding agent köprüsünü kuran araç yok denecek
  kadar az; sentinel'in hikâyesini şirket içinde de dışında da güçlendirir.

## Efor tahmini

| Parça | Süre | Not |
|---|---|---|
| MCP server kabuğu + 4-5 tool | 1-2 gün | `@modelcontextprotocol/sdk` çok işi hallediyor |
| Tarayıcı → process köprüsü | 2-3 gün | Asıl iş: WebSocket + snapshot protokolü + provider'a publish |
| Claude Code ile uçtan uca test/cila | 1 gün | |
| **Toplam** | **~1 hafta** | |

## Açık sorular

- Snapshot ne zaman gönderilir? (interval / her effect'te / talep üzerine "pull" — pull daha temiz olabilir: MCP process tarayıcıya WebSocket üzerinden "şimdiki durumu ver" der)
- Birden çok sekme/sayfa açıkken hangi snapshot geçerli? (son aktif sekme? sekme seçimi tool parametresi?)
- Paket yapısı: `@sentinel-core/mcp` ayrı paket mi, sentinel monorepo'sunda üçüncü workspace mi? (monorepo önerilir — `packages/sentinel-mcp`)
- Komponent bazlı tool gerekir mi? (`get_component_props(name)` — Sentinel wrapper verisi şu an sadece tıklama anında toplanıyor; publish edilecek veri setine komponent kayıtları da eklenmeli mi?)

## İlgili mevcut altyapı

- `packages/sentinel/src/utils/lineage.ts` — zincir kurucu (`buildLineage`)
- `packages/sentinel/src/utils/apiCalls.ts` — istek çıkarımı + IDF korelasyonu (`extractApiCalls`, `correlateProps`)
- `packages/sentinel/src/redux/createSentinelReduxMiddleware.ts` — action log + deep diff
- `packages/sentinel/src/saga/createSentinelSagaMonitor.ts` — effect kayıtları (`parentId` ağacı)
- `packages/sentinel/src/react/provider.tsx` — publish katmanının ekleneceği yer
