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
         patterns: [{
            from: ".",
            to: ".",
            context: "public",
            globOptions: {
               ignore: process.env.NODE_ENV === 'production' 
                  ? ['**/toastui-editor-all.js', '**/toastui-editor.css']  // In production, ignore non-minified
                  : ['**/toastui-editor-all.min.js', '**/toastui-editor.min.css']  // In development, ignore minified
            }
         }]
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
