import "./App.css";
import { Sentinel } from "sentinel";

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
          <div>Sentinel Active</div>
        </Sentinel>
      </section>
    </>
  );
}

export default App;
