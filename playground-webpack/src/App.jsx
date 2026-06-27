import React, { useState } from "react";
import { SentinelProvider, voltranExternalLink } from "@sentinel-core/sentinel";
import { ProductCard } from "./components/ProductCard.jsx";
import { VoltranFragment } from "./components/VoltranFragment.jsx";
import { mockStore } from "./mockStore.js";
import { mockSagaMonitor } from "./mockSagaMonitor.js";

const fragments = [
  {
    fragmentInfo: { id: 53, activeComponent: { componentName: "pdppremiumbanner" }, seoState: {} },
    options: { componentTypeName: "PremiumBanner" },
  },
  {
    fragmentInfo: { id: 61, activeComponent: { componentName: "Follow" }, seoState: {} },
    options: { componentTypeName: "FollowAndCollect" },
  },
  {
    fragmentInfo: { id: 46, activeComponent: { componentName: "AskToSeller" }, seoState: {} },
    options: { componentTypeName: "AskToSeller" },
  },
];

const products = [
  {
    id: 1,
    title: "Minimal Sneakers",
    desc: "Modern tasarıma sahip, günlük kullanım için ideal sneaker model.",
    price: "₺1.299",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
  },
  {
    id: 2,
    title: "Urban Runner",
    desc: "Koşu ve günlük kullanım için hafif performans ayakkabısı.",
    price: "₺1.599",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
  },
  {
    id: 3,
    title: "Classic White",
    desc: "Minimal tasarım, her stile uyum sağlayan klasik sneaker.",
    price: "₺1.199",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772",
    serverHtml:
      '<section class="product-detail" data-id="3"><div class="container"><header class="product-header"><h1 class="title">Classic White</h1><span class="badge badge--new">Yeni Sezon</span></header><div class="product-body"><p class="description">Minimal tasarım felsefesiyle üretilmiş bu sneaker, her stile kolayca uyum sağlar.</p></div></div></section>',
  },
];

function App() {
  const [tick, setTick] = useState(0);

  return (
    <section className="sentinel-root">
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
        <button
          onClick={() => setTick((t) => t + 1)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Force Re-render ({tick})
        </button>
        <SentinelProvider
          store={mockStore}
          sagaMonitor={mockSagaMonitor}
          externalLinks={[voltranExternalLink({ label: "Open in Voltran" })]}
        >
          <div className="flex gap-4 flex-nowrap justify-start">
            {products.map((product) => (
              <ProductCard key={product.id} p={product} tick={tick} />
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, textAlign: "center" }}>
              Voltran Fragments
            </div>
            <div className="flex gap-4 flex-nowrap justify-start">
              {fragments.map((f) => (
                <VoltranFragment key={f.fragmentInfo.id} fragmentInfo={f.fragmentInfo} options={f.options} />
              ))}
            </div>
          </div>
        </SentinelProvider>
      </div>
    </section>
  );
}

export default App;
