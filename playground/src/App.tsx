import "./App.css";
import { SentinelProvider } from "@sentinel-core/sentinel";
import "@sentinel-core/sentinel/index.css";
import { ProductCard } from "./components/ProductCard";

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
    title: "Classic Whitee",
    desc: "Minimal tasarım, her stile uyum sağlayan klasik sneaker.",
    price: "₺1.199",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772",
    serverHtml:
      '<section class="product-detail" data-id="3"><div class="container"><header class="product-header"><h1 class="title">Classic White</h1><span class="badge badge--new">Yeni Sezon</span></header><div class="product-body"><p class="description">Minimal tasarım felsefesiyle üretilmiş bu sneaker, her stile kolayca uyum sağlar. Özel dokuma upper yüzeyi ve memory foam tabanlığı ile uzun süreli konfor sunar.</p><ul class="features"><li>Yıkanabilir örgü üst yüzey</li><li>Memory foam iç taban</li><li>Kaymaz dış taban</li><li>%100 vegan malzeme</li></ul><div class="shipping"><span class="badge">Ücretsiz Kargo</span><span class="badge">30 Gün İade</span><span class="badge">2 Yıl Garanti</span></div></div></div></section>',
  },
];

function App() {
  return (
    <section className="sentinel-root">
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
        <SentinelProvider>
          <div className="flex gap-4 flex-nowrap justify-start">
            {products.map((product) => (
              <ProductCard key={product.id} p={product} />
            ))}
          </div>
        </SentinelProvider>
      </div>
    </section>
  );
}

export default App;
