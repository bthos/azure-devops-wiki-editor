[![Build and Release](https://github.com/bthos/azure-devops-wiki-editor/actions/workflows/main.yml/badge.svg)](https://github.com/bthos/azure-devops-wiki-editor/actions/workflows/main.yml)

# Azure DevOps Wiki Editor

Chrome Extension enables WYSIWYG editor in Azure DevOps markdown wiki. Based on great work of [Toast UI Editor](https://github.com/nhn/tui.editor).

## Prerequisites

- [Node.js](https://nodejs.org/) (v12 or higher)
- npm (comes with Node.js)
- Google Chrome browser

## How to Build

### Development Build

To build the development version of the extension, follow these steps:

1. **Clone the Repository**:
   ```sh
   git clone https://github.com/bthos/azure-devops-wiki-editor.git
   cd azure-devops-wiki-editor
   ```

2. **Install Dependencies**:
   Make sure you have Node.js and npm installed. Then, run the following command to install the required dependencies:
   ```sh
   npm install
   ```

3. **Build the Development Version**:
   Run the following command to build the development version of the extension:
   ```sh
   npm run dev-build
   ```

This will create a development build in the `dist/` directory. The development build includes source maps and unminified code for easier debugging.

### Production Build

To build the production version of the extension, follow these steps:

1. **Install Dependencies**: 
   If you haven't already, install the dependencies:
   ```sh
   npm install
   ```

2. **Build the Production Version**: 
   Run the following command to build the production version of the extension:
   ```sh
   npm run build
   ```

This will create a production build in the `dist/` directory. The production build is optimized with minified code and no source maps. It also creates a ZIP file ready for distribution.

## Development Server

To test the editor functionality locally before installing it as a Chrome extension:

1. Start the development server:
   ```sh
   npm run server
   ```

2. Open your browser and navigate to:
   `http://localhost:8080/test.html`

3. You'll see a test page with the WYSIWYG editor where you can try out the features without needing to install the extension.

## Testing the Extension

### Local Testing

1. Build the extension using either the development or production build steps above
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click on the "Load unpacked" button
5. Select the `dist/` directory where the build files are located
6. Navigate to any Azure DevOps wiki page
7. Try editing a page to verify the WYSIWYG editor appears and functions correctly
8. Test the following features:
   - Basic text formatting (bold, italic, lists)
   - Creating and editing tables
   - Adding links and images
   - Switching between WYSIWYG and Markdown modes
   - Saving changes to the wiki page

### Troubleshooting

If the editor doesn't appear:
1. Check the browser's console for any error messages
2. Try refreshing the page
3. Ensure the extension is enabled in Chrome
4. Verify you're on a supported Azure DevOps wiki page (URL should match `*://dev.azure.com/*/_wiki/*` or `*://*.visualstudio.com/*/_wiki/*`)

## Features

- WYSIWYG editing interface for Azure DevOps Wiki pages
- Real-time preview of markdown changes
- Support for all standard markdown syntax:
  - Headers (H1-H6)
  - Lists (ordered and unordered)
  - Tables with easy editing interface
  - Code blocks with syntax highlighting
  - Task lists (checkboxes)
  - Blockquotes
- Azure DevOps specific features:
  - @mentions support
  - Wiki TOC generation (`[[_TOC_]]`)
  - Wiki links
  - Work item links (#123)
- Image upload and embedding
- Split screen mode (editor/preview)
- Full screen editing mode

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|--------------|-------|
| Bold | Ctrl+B | ⌘+B |
| Italic | Ctrl+I | ⌘+I |
| Strike Through | Ctrl+S | ⌘+S |
| Heading 1-6 | Ctrl+1-6 | ⌘+1-6 |
| Code Block | Ctrl+Shift+C | ⌘+Shift+C |
| Link | Ctrl+K | ⌘+K |
| Switch to HTML | Ctrl+Tab | ⌘+Tab |
| Save Changes | Ctrl+S | ⌘+S |

## Contributing

1. Fork the repository
2. Create a new branch for your feature or bugfix
3. Make your changes
4. Test thoroughly using the steps above
5. Create a pull request with a clear description of your changes

## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.

## Repository

The source code for this project is available at [GitHub](https://github.com/bthos/azure-devops-wiki-editor).

## Bugs and Issues

If you encounter any issues:
1. Check the [existing issues](https://github.com/bthos/azure-devops-wiki-editor/issues) to see if it's already reported
2. If not, create a new issue with:
   - Steps to reproduce the problem
   - Expected behavior
   - Actual behavior
   - Browser version and OS
   - Any relevant error messages from the console

## Dependencies

- `@toast-ui/editor`: ^3.2.2 - The core WYSIWYG editor component
- `jquery`: ^3.7.0 - Used for DOM manipulation

## DevDependencies

- `@types/chrome`: ^0.0.239 - TypeScript definitions for Chrome extension APIs
- `@types/jquery`: ^3.5.16 - TypeScript definitions for jQuery
- `copy-webpack-plugin`: ^11.0.0 - Copies static assets during build
- `cross-env`: ^7.0.3 - Sets environment variables across platforms
- `ts-loader`: ^9.4.4 - TypeScript loader for webpack
- `typescript`: ^5.1.6 - TypeScript compiler
- `webpack`: ^5.88.1 - Module bundler
- `webpack-cli`: ^5.1.4 - Webpack command line interface
- `zip-webpack-plugin`: ^4.0.3 - Creates ZIP file for production builds

## Scripts

- `test`: Currently not implemented (placeholder)
- `dev-build`: Builds development version with source maps
- `build`: Builds production version with optimizations and creates ZIP file
