import "./App.css";
import { Sentinel, SentinelProvider } from "sentinel";
import "sentinel/index.css";

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
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTl8fHNuZWFrZXJzfGVufDB8fDB8fHww",
  },
];

// 🖼 IMAGE COMPONENT
const ProductImage = ({ src }: { src: string }) => {
  return (
    <Sentinel>
      <img
        style={{
          width: "100%",
          height: "180px",
          objectFit: "cover",
        }}
        src={src}
        alt="product"
      />
    </Sentinel>
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
  const styles: { [key: string]: React.CSSProperties } = {
    content: {
      padding: "16px",
    },
    title: {
      fontSize: "18px",
      fontWeight: 600,
      margin: "0 0 8px 0",
    },
    desc: {
      fontSize: "13px",
      color: "#666",
      marginBottom: "12px",
      lineHeight: 1.4,
    },
    price: {
      fontSize: "16px",
      fontWeight: 700,
      color: "#2ecc71",
      marginBottom: "12px",
    },
    button: {
      width: "100%",
      padding: "10px",
      border: "none",
      borderRadius: "10px",
      backgroundColor: "#111",
      color: "#fff",
      cursor: "pointer",
    },
  };

  return (
    <Sentinel>
      <div style={styles.content}>
        <h3 style={styles.title}>{title}</h3>

        <p style={styles.desc}>{desc}</p>

        <div style={styles.price}>{price}</div>
        <Sentinel dialogTitle="buton">
          {" "}
          <button style={styles.button}>Sepete Ekle</button>
        </Sentinel>
      </div>
    </Sentinel>
  );
};

function App() {
  return (
    <section id="center">
      <SentinelProvider>
        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "nowrap",
            justifyContent: "flex-start",
          }}
        >
          {products.map((p) => (
            <Sentinel key={p.id}>
              <div
                style={{
                  width: "280px",
                  borderRadius: "16px",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  fontFamily: "Arial, sans-serif",
                }}
              >
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
