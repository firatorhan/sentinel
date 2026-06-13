import React from "react";
import { SentinelProvider } from "@sentinel-core/sentinel";
import { ProductCard } from "./components/ProductCard.jsx";


function App() {
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
  return (
    <section className="min-h-screen flex items-center justify-center bg-background">
     
        <div className="flex gap-4 flex-nowrap justify-start">
          {products.map((product) => (
            <ProductCard key={product.id} p={product} />
          ))}
          aa
        </div>
     
    </section>
  );
}

export default App;
