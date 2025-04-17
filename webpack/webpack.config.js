const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');

module.exports = {
   entry: {
      background: path.resolve(__dirname, "..", "src", "background.ts")
   },
   output: {
      path: path.join(__dirname, "../dist"),
      filename: "[name].js",
   },
   resolve: {
      extensions: [".ts", ".js"],
   },
   module: {
      rules: [
         {
            test: /\.tsx?$/,
            loader: "ts-loader",
            exclude: /node_modules/,
         },
      ],
   },
   plugins: [
      new CopyPlugin({
         patterns: [
            {from: ".", to: ".", context: "public"}
         ]
      }),
      ...(process.env.NODE_ENV === 'production' ? [
         new ZipPlugin({
            path: '../',
            filename: 'azure-devops-wiki-editor.zip',
            pathPrefix: 'dist/',
         })
      ] : [])
   ],
};
