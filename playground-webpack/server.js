const express = require("express");
const webpack = require("webpack");

const config = require("./webpack.config");
const compiler = webpack(config);

const webpackDevMiddleware = require("webpack-dev-middleware");
const webpackHotMiddleware = require("webpack-hot-middleware");

const app = express();

// 🔥 dev middleware (memory build)
app.use(
  webpackDevMiddleware(compiler, {
    publicPath: config.output.publicPath
  })
);

// 🔥 hot middleware (HMR websocket)
app.use(webpackHotMiddleware(compiler));

// static fallback
app.use(express.static("public"));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});