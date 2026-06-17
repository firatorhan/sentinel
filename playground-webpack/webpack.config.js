const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { sentinelWebpackPlugin } = require("@sentinel-core/sentinel-plugin");

module.exports = {
  mode: "development",

  entry: ["webpack-hot-middleware/client?reload=true", "./src/index.jsx"],

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    publicPath: "/",
  },

  resolve: {
    extensions: [".js", ".jsx"],
    conditionNames: ["require", "default"],
  },

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.md$/,
        resourceQuery: /raw/,
        type: "asset/source",
      },
    ],
  },
  

  plugins: [
    sentinelWebpackPlugin({
     include: ["src/components/**/*.jsx"],
    }),
    new webpack.HotModuleReplacementPlugin(),
    new HtmlWebpackPlugin({
      template: "./public/index.html",
    }),
  ],
};
