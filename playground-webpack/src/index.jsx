import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "@sentinel-core/sentinel/index.css";

function render(AppComponent) {
  ReactDOM.render(
    <AppComponent />,
    document.getElementById("root")
  );
}

render(App);

// HMR
if (module.hot) {
  module.hot.accept("./App", () => {
    const NextApp = require("./App").default;
    render(NextApp);
  });
}