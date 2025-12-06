---
description: AI rules derived by SpecStory from the project AI interaction history
globs: *
---

---
description: AI coding instructions for Azure DevOps Wiki Editor
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

## Removed Features

Removed due to infinite loops/complexity:
- Copy button on code blocks
- Video/Mermaid block detection

## Research Resources

Use [awesome-research](https://github.com/bthos/awesome-research) as a source of research results that could be used for implementation guidance.