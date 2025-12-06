---
description: AI rules derived by SpecStory from the project AI interaction history
globs: *
---

## HEADERS

## TECH STACK

*   `@milkdown/kit` - Core editor framework with presets and plugins
*   `@milkdown/theme-nord` - Theme for styling
*   `uv` - Fast Python package installer and resolver. (version 0.7.15 confirmed working).
*   `uvx` - Part of the `uv` package, used by imagesorcery.

## MILKDOWN ARCHITECTURE

Reference: <https://milkdown.dev/docs/guide/architecture-overview>

Milkdown is built with a modular, layered architecture. Reference: <https://milkdown.dev/docs/guide/architecture-overview>

### Core Architecture Layers

1.  **🥛 Core Layer** - Foundation providing plugin loading/management, core editor concepts, base document model integration, and essential utilities.
2.  **🧇 Plugin Layer** - Modular plugins: syntax (Markdown, GFM), UI (toolbar, menu), features (image upload, table), utilities (history, clipboard).
3.  **🍮 Component Layer** - Headless UI components: toolbar, slash menu, table components.
4.  **🍰 Editor Layer** - Ready-to-use editors like Crepe and custom implementations.

### Markdown Transformation Pipeline

**Parsing:** Markdown text → Remark AST → ProseMirror Schema → ProseMirror Document

**Serialization:** ProseMirror Document → ProseMirror Schema → Remark AST → Markdown text

### Context System (Ctx)

The Context System enables plugins to work together via state management and dependency coordination.

#### Core Concepts

*   **Context (Ctx)** - Main interface for plugins: `get`, `set`, `wait`, `done`, `inject`, `remove`, `watch` methods.
*   **Slices** - State containers shared between plugins. Created with `createSlice(initialValue, name)`
*   **Timers** - Dependency management for plugin coordination. Created with `createTimer(name)`.

#### Plugin Lifecycle Pattern

```typescript
const examplePlugin: MilkdownPlugin = (ctx) => {
  // 1. Setup Phase - inject slices, record timers
  ctx.inject(mySlice, defaultValue);
  ctx.record(myTimer);

  return async () => {
    // 2. Initialization Phase - wait for dependencies
    await ctx.wait(RequiredTimer);

    // 3. Runtime Phase - read/write state
    const value = ctx.get(mySlice);
    ctx.set(mySlice, newValue);

    // 4. Cleanup Phase - remove resources
    return () => {
      ctx.remove(mySlice);
    };
  };
};
```

#### Best Practices

*   **State Management:** Use slices for shared state, keep state minimal, watch for changes when needed.
*   **Dependency Management:** Use timers for coordination, wait for required dependencies, mark completion appropriately.
*   **Plugin Organization:** Follow the lifecycle pattern, clean up resources properly, document dependencies clearly.

## PROJECT DOCUMENTATION & CONTEXT SYSTEM

Reference: <https://milkdown.dev/docs/guide/architecture-overview>

## CODING STANDARDS

## WORKFLOW & RELEASE RULES

*   `EXTENSION_PATH` should be a relative path.
*   `LOCAL_TEST_URL` should be a relative path.

## DEBUGGING

If encountering a `spawn uvx ENOENT` error with the imagesorcery MCP server in VS Code:

1.  Ensure `uv` and `uvx` (from the `uv` Python package manager) are installed.
2.  Add `` to your Windows user PATH environment variable.
3.  Restart VS Code completely for the change to take effect.

If the DeepWiki MCP server fails to connect to its API endpoint (`https://api.deepwiki.com/mcp/sse`) with a `fetch failed` error:

1.  Check if the API is accessible by opening `https://api.deepwiki.com` in your browser.
2.  Ensure a stable internet connection.
3.  If behind a corporate proxy, configure proxy settings:
    ```bash
    # Set environment variables if needed
    export HTTP_PROXY=http://your-proxy:port
    export HTTPS_PROXY=http://your-proxy:port
    ```
4.  Restart VS Code.
5.  Verify DeepWiki MCP server configuration in VS Code settings.
6.  Disable and re-enable the DeepWiki MCP server in VS Code settings.

## BEST PRACTICES

*   The `[[_TOC_]]` marker should display a live preview of the document's actual headers, but remain editable as the `[[_TOC_]]` text marker. The TOC preview is just a visual representation, not actual editable content. The TOC should not include automatic numbering.
*   The widgets should follow Microsoft Fabric UI design patterns with:
    *   Card-style layout with subtle box-shadow (Fabric depth effect). Shadows should be removed.
    *   Header bar with secondary background color and uppercase title
    *   Compact `width: 220px` for a cleaner look.
    *   Nested TOC items with left border indicator line
    *   Link hover states with subtle background highlight instead of underline
    *   Smooth transitions on hover (shadow elevation increases)
    *   Centered 24x24px icon button (Fabric IconButton pattern) that is always visible, with a red tint on hover to indicate destructive action. It should always be visible in high contrast modes. Use absolute positioning for the delete button so it doesn't affect the layout. Use `visibility` and `opacity` instead of `display` to prevent layout shifts.
    *   Light theme with standard Fabric shadows. Shadows should be removed.
    *   Dark theme with deeper shadows and adjusted colors. Shadows should be removed.
    *   High Contrast Dark/Light with 2px borders, no shadows, and proper contrast ratios
*   ProseMirror expects the CSS white-space property to be set, preferably to 'pre-wrap'. Load style/prosemirror.css from the prosemirror-view package. Ensure the `.milkdown .ProseMirror` selector has the `white-space: pre-wrap` property. Also ensure `word-wrap: break-word` and `font-variant-ligatures: none` are applied to `.milkdown .ProseMirror`.
*   When serializing markdown, unescape characters to properly display mentions and video blocks. Specifically, replace `\<` with `<`, and `\.` with `.` in `@<user name>` mentions.
*   When working with ADO markers, the following are supported:
    *   `[[_TOC_]]` - Table of Contents widget with live preview and delete button. The TOC should not include automatic numbering.
    *   `[[_TOSP_]]` - Table of Sub-Pages widget with delete button.
    *   `#123456` - Work item references (require 2+ digits).
    *   `@<user name>` - User mentions.
*   The following were removed due to causing infinite loops or complexity:
    *   Copy button on code blocks.
    *   Video/Mermaid block detection.

## ROBOT FRAMEWORK AUTOMATED TESTS

*   Based on `https://github.com/bthos/robot-automation-blueprint` template.
*   Uses relative paths for `EXTENSION_PATH` and `LOCAL_TEST_URL`.
    *   `EXTENSION_PATH` should be a relative path.
    *   `LOCAL_TEST_URL` should be a relative path.
*   Includes test suites for basic editor functionality and ADO markers.
*   The `EXTENSION_PATH` in `.env.example` should be a relative path.
*   The `LOCAL_TEST_URL` in `.env.example` should be a relative path.
*   `${LOCAL_TEST_URL}` should not contain an absolute path. It must be a relative path. It can be replaced with a relative path like `${CURDIR}/../../../playground.html` which resolves relative to the `resources/` directory.