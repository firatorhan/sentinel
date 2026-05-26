import "./App.css";
import { Sentinel } from "sentinel";
import "sentinel/index.css";
function App() {
  return (
    <>
      <section id="center">
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <Sentinel>
          <div
            style={{
              height: "100px",
              width: "100%",
              backgroundColor: "lightgray",
            }}
          >
            Sentinel Active
          </div>
        </Sentinel>
        <div className="mt-[400px]">
          <Sentinel>
            <div
              style={{
                height: "100px",
                width: "400px",
                backgroundColor: "lightgray",
               
              }}
            >
              Sentinel Active
            </div>
          </Sentinel>
        </div>
      </section>
    </>
  );
}

export default App;
