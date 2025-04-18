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
      // Add a new entry to create a standalone bundle with Toast UI Editor 
      "editor-bundle": path.resolve(__dirname, "..", "src", "editor-bundle.ts")
   },
   output: {
      path: path.join(__dirname, "../dist"),
      filename: "[name].js",
   },
   // Using 'inline-source-map' instead of the default 'eval' for development
   // This prevents CSP errors in Chrome extensions
   devtool: isProduction ? false : 'inline-source-map',
   resolve: {
      extensions: [".ts", ".js"],
   },
   externals: {
      // Only use this as external in production mode
      ...(isProduction ? {
         '@toast-ui/editor': {
            commonjs: '@toast-ui/editor',
            commonjs2: '@toast-ui/editor',
            amd: '@toast-ui/editor',
            root: ['toastui', 'Editor']
         }
      } : {})
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
      minimize: process.env.NODE_ENV === 'production',
      minimizer: [
         new TerserPlugin({
            test: /\.js$/
         }),
         new CssMinimizerPlugin()
      ],
   },
   plugins: [
      new CopyPlugin({
         patterns: [
            // Copy static assets from public
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
            // Copy Toast UI Editor CSS
            {
               from: 'node_modules/@toast-ui/editor/dist/toastui-editor.css',
               to: 'toastui-editor.css'
            }
            // jQuery copy removed as it's no longer needed
         ]
      }),
      new ZipPlugin({
         path: path.join(__dirname, '..'),
         filename: process.env.NODE_ENV === 'production' 
            ? 'azure-devops-wiki-editor.zip'
            : 'azure-devops-wiki-editor-dev.zip',
         pathPrefix: 'dist/',
      })
   ]
};
