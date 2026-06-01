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
    title: "Classic White",
    desc: "Minimal tasarım, her stile uyum sağlayan klasik sneaker.",
    price: "₺1.199",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772",
  },
];

function App() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-background">
      <SentinelProvider>
        <div className="flex gap-4 flex-nowrap justify-start">
          {products.map((product) => (
            <ProductCard key={product.id} p={product} />
          ))}
        </div>
      </SentinelProvider>
    </section>
  );
}

export default App;
