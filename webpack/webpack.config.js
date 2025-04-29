const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
   entry: {
      background: path.resolve(__dirname, "..", "src", "background.ts"),
      main: path.resolve(__dirname, "..", "src", "main.ts"),
      "editor-bundle": path.resolve(__dirname, "..", "src", "editor-bundle.ts")
   },
   output: {
      path: path.join(__dirname, "../dist"),
      filename: "[name].js",
   },
   devtool: isProduction ? false : 'source-map',
   resolve: {
      extensions: [".ts", ".js"],
   },
   module: {
      rules: [
         {
            test: /\.tsx?$/,
            loader: "ts-loader",
            exclude: /node_modules/,
         }
      ],
   },
   optimization: {
      minimize: isProduction,
      minimizer: [
         new TerserPlugin({
            terserOptions: {
               compress: {
                  drop_console: false,
                  drop_debugger: isProduction
               }
            }
         }),
         new CssMinimizerPlugin()
      ],
      splitChunks: false
   },
   plugins: [
      new CopyPlugin({
         patterns: [
            {
               from: ".",
               to: ".",
               context: "public",
               globOptions: {
                  ignore: [
                     '**/main.js',
                     '**/jquery-*.js',
                     '**/toastui-editor*.js',
                     '**/toastui-editor*.css'
                  ]
               }
            },
            {
               from: 'node_modules/@toast-ui/editor/dist/toastui-editor.css',
               to: 'toastui-editor.css'
            }
         ]
      }),
      new ZipPlugin({
         path: path.join(__dirname, '..'),
         filename: isProduction 
            ? 'azure-devops-wiki-editor.zip'
            : 'azure-devops-wiki-editor-dev.zip',
         pathPrefix: 'dist/'
      })
   ]
}
