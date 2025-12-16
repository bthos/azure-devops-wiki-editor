---
description: AI rules derived by SpecStory from the project AI interaction history
globs: *
---

# Azure DevOps Wiki Editor - AI Coding Guide

## Project Overview

Chrome extension that adds WYSIWYG markdown editing to Azure DevOps Wiki pages using [Milkdown](https://milkdown.dev) framework. Injects into ADO wiki edit pages and provides a toggle between Markdown and WYSIWYG modes.

## Architecture

```
src/
├── main.ts              # Content script - DOM injection, mode toggle, editor lifecycle
├── editor-bundle.ts     # Milkdown editor assembly - exports all plugins
├── background.ts        # Extension background script
├── ado-markers-plugin.ts # ProseMirror decorations for ADO markers (legacy)
├── syntax/              # ADO-specific Milkdown syntax extensions
│   ├── ado-toc-node.ts      # [[_TOC_]] - Table of Contents widget
│   ├── ado-tosp-node.ts     # [[_TOSP_]] - Table of Sub-Pages widget
│   ├── ado-work-item-mark.ts # #123456 - Work item references
│   └── ado-mention-mark.ts   # @<user name> - User mentions
├── theme/               # Azure DevOps theme (light/dark/high-contrast)
└── toolbar/             # Formatting toolbar plugin
```

## Key Commands

```bash
npm run dev-build    # Development build with source maps → dist/
npm run build        # Production build (minified, ZIP) → dist/
npm run server       # Local dev server at http://localhost:8080/playground.html
npm run clean        # Clean dist/ directory
```

## Milkdown Plugin Development

Follow the [Milkdown architecture](https://milkdown.dev/docs/guide/architecture-overview):

```typescript
// Plugin lifecycle pattern (see src/syntax/ for examples)
const myPlugin: MilkdownPlugin = (ctx) => {
  ctx.inject(mySlice, defaultValue);  // 1. Setup - inject state slices
  ctx.record(myTimer);                 // Record timers for coordination

  return async () => {
    await ctx.wait(RequiredTimer);     // 2. Init - wait for dependencies
    const value = ctx.get(mySlice);    // 3. Runtime - read/write state

    return () => ctx.remove(mySlice);  // 4. Cleanup
  };
};
```

**Markdown Pipeline:** `Markdown text → Remark AST → ProseMirror Schema → ProseMirror Document` (and reverse)

## ADO Markers

Supported markers in `src/syntax/`:
- `[[_TOC_]]` - Live TOC preview widget (no automatic numbering)
- `[[_TOSP_]]` - Table of Sub-Pages widget
- `#123456` - Work item references (2+ digits required)
- `@<user name>` - User mentions with angle brackets

**Serialization:** Unescape `\<` → `<` and `\.` → `.` for mentions.

## Theming

- UI components: `public/custom-styles.css`
- Editor content: `src/theme/ado-theme.css`
- Theme detection: `detectAdoTheme()` returns `light | dark | hc-dark | hc-light`
- Selector pattern: `body[data-theme="ms.vss-web.vsts-theme-dark"]`

**Widget styling:**
- Microsoft Fabric UI patterns, no shadows
- High Contrast: 2px borders, proper contrast ratios
- Delete buttons: always visible, use `visibility`/`opacity` not `display`

## Robot Framework Tests

```bash
cd tests && ./setup.sh   # One-time setup
./run_tests.sh           # Run all tests
./run_tests.sh --browser # Visible browser
```

**Use relative paths only:**
- `LOCAL_TEST_URL=../playground.html` (in tests/.env)
- In Robot: `${CURDIR}/../../../playground.html`

## Critical CSS

Ensure `.milkdown .ProseMirror` has:
```css
white-space: pre-wrap;
word-wrap: break-word;
font-variant-ligatures: none;
```

## Special Character Handling

When switching between WYSIWYG and Markdown, ensure that `[[_TOC_]]` and `[[_TOSP_]]` are not escaped. To prevent Azure DevOps rendering issues:

- In `src/main.ts`, refine the `postprocessAdoMarkers` function.
- Add regex replacements to convert the escaped forms `\[\[\_TOC\_]]` and `\[\[\_TOSP\_]]` back to their unescaped counterparts. This ensures these elements render correctly. Additionally, handle cases where underscores within the markers are not escaped (e.g., `\[\[_TOC_]]` and `\[\[_TOSP_]]`). The current regex handles optional escaping for brackets, underscores, and closing brackets.

```typescript
// src/main.ts

function postprocessAdoMarkers(content: string): string {
    return content
        // Restore @‹user› back to @<user>
        .replace(/@‹([^›]+)›/g, '@<$1>')
        // Restore escaped angle brackets: \< → <
        .replace(/\\</g, '<')
        // Restore TOC and TOSP markers with flexible escaping
        .replace(/\\?\[\\?\[\\?_TOC\\?_\\?\]\\?\]/g, '[[_TOC_]]')
        .replace(/\\?\[\\?\[\\?_TOSP\\?_\\?\]\\?\]/g, '[[_TOSP_]]');
}
```

## UI Updates

The Quote button icon in `src/toolbar/view.ts` has been updated to use a standard double-quote icon, which is more recognizable.

The "Insert Table" icon in `view.ts` has been updated to be a distinct 2x2 grid icon, differentiating it from the "Table Options" icon which remains as the detailed table icon.

## Removed Features

Removed due to infinite loops/complexity:
- Copy button on code blocks
- Video/Mermaid block detection

## Research Resources

Use [awesome-research](https://github.com/bthos/awesome-research) as a source of research results that could be used for implementation guidance.

## Development Server

The local development server can be started by running `npm run server`. This will launch the playground at http://localhost:8080/playground.html.

Before running the Robot Framework tests, ensure the test environment is properly set up by running `tests/setup.sh`. This script creates and activates a virtual environment.

## Playground Test Data

The `playground.html` file has been updated with a comprehensive set of test data, including:

*   **ADO Markers:** Standard `[[_TOC_]]` and `[[_TOSP_]]`, plus various escaped forms (`\[\[_TOC_]]`, `\[\[\_TOC\_]]`, etc.) to verify the regex fix.
*   **Mentions:** Examples with dots and spaces (`@<user1>`, `@<another.user2>`, `@<another user3>`).
*   **Work Items:** Examples like `#123456`.
*   **Tables:** Tables with and without mentions.
*   **Task Lists:** Checked and unchecked items.
*   **Code Blocks:** A JavaScript code block.
*   **Headings:** Nested headings to test TOC structure.
*   **Toolbar Elements:** Examples of elements that can be inserted or configured from the toolbar.