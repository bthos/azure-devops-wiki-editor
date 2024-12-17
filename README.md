# Azure DevOps Wiki Editor

Chrome Extension enables WYSIWYG editor in Azure DevOps markdown wiki. Based on great work of [Toast UI Editor](https://github.com/nhn/tui.editor).

## How to Build

### Development Build

To build the development version of the extension, follow these steps:

1. **Install Dependencies**:
   Make sure you have Node.js and npm installed. Then, run the following command to install the required dependencies:

   ```sh
   npm install

2. **Build the Development Version**:
   Run the following command to build the development version of the extension:

   ```sh
   npm run dev-build

This will create a development build in the `dist/` directory.


### Production Build
To build the production version of the extension, follow these steps:

1. **Install Dependencies**: 
   Make sure you have Node.js and npm installed. Then, run the following command to install the required dependencies:

   ```sh
   npm install

2. **Build the Production Version**: 
   Run the following command to build the production version of the extension:

   ```sh
   npm run build

This will create a production build in the `dist/` directory.


## Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable "Developer mode" by toggling the switch in the top right corner.
3. Click on the "Load unpacked" button.
4. Select the `dist/` directory where the build files are located.

Your extension should now be loaded and ready to use in Chrome.


## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.


## Repository

The source code for this project is available at [GitHub](https://github.com/bthos/azure-devops-wiki-editor).


## Bugs and Issues

If you encounter any issues, please report them at [GitHub Issues](https://github.com/bthos/azure-devops-wiki-editor/issues).


## Dependencies

- `@toast-ui/editor`: ^3.2.2
- `jquery`: ^3.7.0


## DevDependencies

- `@types/chrome`: ^0.0.239
- `@types/jquery`: ^3.5.16
- `copy-webpack-plugin`: ^11.0.0
- `ts-loader`: ^9.4.4
- `typescript`: ^5.1.6
- `webpack`: ^5.88.1
- `webpack-cli`: ^5.1.4


## Scripts

- `test`: `echo "Error: no test specified" && exit 1`
- `dev-build`: `webpack --config webpack/webpack.config.js --mode=development`
- `build`: `webpack --config webpack/webpack.config.js --mode=production`
