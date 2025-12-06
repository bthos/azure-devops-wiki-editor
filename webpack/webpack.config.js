const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

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
      // Prevent async chunk creation - bundle everything into main files
      asyncChunks: false,
   },
   // Source maps: 'source-map' for debugging, false to disable
   // Set to false to reduce package size
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
         },
         {
            test: /\.css$/,
            oneOf: [
               // For CSS files from node_modules (Milkdown), inline them as style
               {
                  include: /node_modules/,
                  use: ['style-loader', 'css-loader']
               },
               // For other CSS files (custom-styles.css from public), use MiniCssExtractPlugin
               {
                  use: [MiniCssExtractPlugin.loader, 'css-loader']
               }
            ],
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
      // Define Vue.js feature flags to suppress warnings
      new webpack.DefinePlugin({
         __VUE_OPTIONS_API__: JSON.stringify(true),
         __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
         __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
      }),
      new MiniCssExtractPlugin({
         filename: (pathData) => {
            // Name CSS files based on the entry point name
            if (pathData.chunk.name === 'editor-bundle') {
               return 'milkdown-editor.css';
            }
            return '[name].css';
         }
      }),
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
