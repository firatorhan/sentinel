import "./App.css";
import { Sentinel, SentinelProvider } from "sentinel";
import "sentinel/index.css";
import Example from "./assets/example.md?raw";
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
    image:
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTl8fHNuZWFrZXJzfGVufDB8fDB8fHww",
  },
];

// 🖼 IMAGE COMPONENT
const ProductImage = ({ src }: { src: string }) => {
  return (
    <img className="w-full h-[180px] object-cover" src={src} alt="product" />
  );
};

// 🧾 CONTENT COMPONENT
const ProductContent = ({
  title,
  desc,
  price,
}: {
  title: string;
  desc: string;
  price: string;
}) => {
  return (
    <Sentinel>
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>

        <p className="text-xs text-muted-foreground mb-3 leading-5">{desc}</p>

        <div className="text-base font-bold text-emerald-500 mb-3">{price}</div>

        <Sentinel dialogTitle="buton">
          <button className="w-full py-2 rounded-lg bg-black text-white hover:bg-zinc-800 transition">
            Sepete Ekle
          </button>
        </Sentinel>
      </div>
    </Sentinel>
  );
};

function App() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-background">
      <SentinelProvider>
        <div className="flex gap-4 flex-nowrap justify-start">
          {products.map((p) => (
            <Sentinel key={p.id} dialogMd={Example} componentProps={p}>
              <div className="rounded-2xl overflow-hidden bg-white shadow-lg w-64">
                <ProductImage src={p.image} />
                <ProductContent title={p.title} desc={p.desc} price={p.price} />
              </div>
            </Sentinel>
          ))}
        </div>
      </SentinelProvider>
    </section>
  );
}

export default App;
