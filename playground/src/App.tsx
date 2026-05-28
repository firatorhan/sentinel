import "./App.css";
import { Sentinel } from "sentinel";
import "sentinel/index.css";
function App() {
  const styles: { [key: string]: React.CSSProperties } = {
    card: {
      width: "280px",
      borderRadius: "16px",
      overflow: "hidden",
      backgroundColor: "#fff",
      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
      fontFamily: "Arial, sans-serif",
    },
    image: {
      width: "100%",
      height: "180px",
      objectFit: "cover", // artık hata vermez
    },
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
    <>
      <section id="center">
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>

        <div>
          <Sentinel>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Sentinel>
                  <div key={i} style={styles.card}>
                    <img
                      style={styles.image}
                      src="https://images.unsplash.com/photo-1523275335684-37898b6baf30"
                      alt="product"
                    />

                    <div style={styles.content}>
                      <h3 style={styles.title}>Minimal Sneakers</h3>

                      <p style={styles.desc}>
                        Modern tasarıma sahip, günlük kullanım için ideal
                        sneaker model.
                      </p>

                      <div style={styles.price}>₺1.299</div>

                      <button style={styles.button}>Sepete Ekle</button>
                    </div>
                  </div>
                </Sentinel>
              ))}
            </div>
          </Sentinel>
        </div>
      </section>
    </>
  );
}

export default App;
