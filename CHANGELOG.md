# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Live demo:** the WYSIWYG editor now runs in the browser at <https://bthos.github.io/azure-devops-wiki-editor/> — `playground.html` is built and deployed to GitHub Pages on every push to `main` (`.github/workflows/pages.yml`).
- **WYSIWYG ⇄ Markdown toggle switch:** flip between the WYSIWYG editor and the native Azure DevOps Markdown editor in place, without leaving the page (`createModeToggle` / `enableWysiwygMode` / `disableWysiwygMode` in `src/main.ts`). Toggle-switch position (left/right) is configurable from the popup.
- **Popup settings:** toggle-switch **position** (left/right) and **Custom Domains** management for on-premises Azure DevOps Server, plus dark-mode-aware popup styling that follows the browser's `prefers-color-scheme` (`public/popup.html`, `public/popup.js`).
- **Azure DevOps theme integration:** the editor follows the active ADO theme (Light, Dark, High Contrast Dark/Light) via `isDarkTheme()` and `WIKI_EDITOR_DARK_CLASS` applied at mount.
- **Table toolbar:** grid picker to insert tables by dimension, plus add/delete row & column and delete-table commands, and HTML-block insertion (`wiki-table-commands.ts`, `wiki-pm-toolbar-html.ts`).
- **Work item refs (`#12345`):** markdown-it recognizes Azure DevOps-style references (≥2 digits, not URL fragments / hex-style tails). ProseMirror mark `wikiWorkItem` renders as chip (`.ado-work-item-ref`); saved markdown stays plain `#12345`. Link to `_workitems/edit/{id}` when the page URL is an ADO wiki (`buildAdoWorkItemEditHref` in `ado-wiki-api.ts`). Tests: `wiki-work-item-markdown.spec.ts`, `wiki-work-item-match.ts`.
- **Video embeds (ADO `::: video` … `:::`):** HTTPS-only URLs, max length 2048, no credentials in the URL. ProseMirror atom `ado_video_block` with widget (`wiki-video-widget-plugin.ts`); direct `https` links to `.mp4` / `.webm` / `.ogg` get a native `<video controls>` preview when the host allows it (otherwise placeholder + **Open** link). Parse/serialize round-trip via `wiki-markdown-video-container-it.ts`, `wiki-markdown-parser.ts`, `wiki-markdown-serializer.ts`; toolbar inserts a sample HTTPS MP4 (`insertWikiVideoBlock`). Tests: `wiki-video-url.spec.ts`, `wiki-video-markdown.spec.ts`.
- **Toolbar:** buttons **Mermaid**, **f(x)** (inline math), and **∫** (display math) next to Code block; wired in `wiki-pm-toolbar-html.ts` / `wiki-toolbar.ts` with `insertWikiMermaidBlock`, `insertWikiMathInline`, `insertWikiMathDisplayBlock` in `wiki-insert-markers.ts`.
- **Math inline (ADO):** parse + serialize **`$x+y$`** (same-line; skip digit-only “price” spans); legacy `\(` … `\)` still parses and saves as `$…$` (`wiki-markdown-math-it.ts`, `wiki-markdown-serializer.ts`).
- **Mermaid diagrams:** Azure DevOps **`::: mermaid` … `:::`** container parsed via `wiki-markdown-mermaid-container-it.ts`; markdown still maps to `code_block` + widget. **Serialize** emits the ADO container; fenced `` ```mermaid `` still **parses** and is normalized on save. `wiki-mermaid-render.ts`, `wiki-mermaid-code-block-widget.ts`. Tests: `tests/unit/wiki-mermaid-markdown.spec.ts`. **Bundle:** `content.js` grows substantially (~+6 MB dev IIFE) because Mermaid is included in the content script.
- **Wiki math (KaTeX):** safe delimiters `\(...\)`, `$$…$$`, and `\[…\]` (no single-`$` inline). `markdown-it` rules, `wiki_math_*` schema atoms, serializer normalizes display to `$$` blocks, node views + `trust: false` rendering. KaTeX CSS/fonts copied to `dist/katex/` at build; manifest loads `katex/katex.min.css`. Tests: `tests/unit/wiki-math-markdown.spec.ts`.
- **Readonly code-block syntax highlighting** in the wiki code widget (`wiki-code-highlight.ts`, highlight.js with ten bundled grammars + aliases). Unknown languages and very large snippets fall back to plain text; dark theme token colors in `ado-theme.css`. Tests: `tests/unit/wiki-code-highlight.spec.ts`.
- **Editor history (Option C):** `wiki-editor-history-config.ts` tunes `prosemirror-history` (`depth`, `newGroupDelay`). Multi-file attachment uploads dispatch as **one** undo step via `closeHistory` + batched steps in `wiki-attachment-upload.ts`. Tests: `tests/unit/wiki-editor-history.spec.ts`.

### Changed

- **Major editor rewrite (#20):** the extension now ships a hand-rolled **ProseMirror + markdown-it** WYSIWYG editor bundled with **esbuild**. The previous editor and its `webpack` build were removed; tests moved to **Vitest**. This is the foundation for the toggle, table, math, Mermaid, video, work-item, and theming features above.

> **Note:** `package.json` / `public/manifest.json` are at **3.1.3**, but no `v3.1.x` tags or per-version changelog entries were cut for the rewrite line. The changes above are grouped under `[Unreleased]` until a release is tagged. When cutting it, decide whether the published Chrome Web Store version (currently 1.0.10) adopts the `3.x` manifest version or restarts numbering.

## [3.1.0] - 2026-04-21

### Added

- **ProseMirror toolbar — text & highlight colors**  
  - One **Text & highlight colors** dropdown with two native `<input type="color">` controls (foreground + background).  
  - Applies the `wikiStyle` mark (`src/editor/wiki-schema.ts`): serializes to raw wiki HTML `<span style="color:…;background-color:…">` and round-trips through `markdown-it` `html_inline` without using `ado_html_inline` atoms.  
  - Reset actions: clear text color, clear highlight, reset both (`applyWikiStyle` in `src/editor/wiki-insert-markers.ts`).  
- **Contributor doc:** [`docs/wiki-editor.md`](docs/wiki-editor.md) — DOM contract (`wiki-editor-root`, …), `wikiStyle` behavior, file map.
- **Unit tests** for wiki markdown, tables, task lists, heading anchors, hosts, mention service, and related helpers (`tests/unit/wiki-*.spec.ts`, …).

### Changed

- **ADO wiki API, mention service, syntax glue** — updates aligned with the ProseMirror path and attachment flows (see git history for detail).

## [3.0.1] - 2026-04-19

### Fixed

- **Wiki attachment upload (Azure DevOps REST)**  
  - Use **Attachments – Create (Wiki)** with the file name in the `name` **query** parameter and `api-version=7.1`, not a path segment such as `.../attachments/{fileName}`.  
  - Send the file as **Base64**, then transmit those ASCII characters as **UTF-8 bytes** with `Content-Type: application/octet-stream`. Raw file bytes caused HTTP 500 (*invalid Base-64 string*); `text/plain` caused HTTP 400 (*Content-Type not supported for PUT*).  
  - When the wiki page has a version, send `versionDescriptor.versionType=branch` and `versionDescriptor.version` (aligned with `normalizeWikiVersionForGitApi` in `src/ado-wiki-api.ts`) so uploads land on the correct branch.  
  - Failed uploads now include **HTTP status** and response body details when available.

### Added

- Maintainer documentation: [`docs/wiki-attachments.md`](docs/wiki-attachments.md) (endpoint shape, body encoding, manifest / credentials).  
- Unit tests for attachment upload URL construction and request shape (`tests/unit/attachment-service.spec.ts`).

### Changed

- **README**: long technical attachment notes replaced with a short **Developer documentation** link to `docs/wiki-attachments.md`.  
- **README**: `test` script description updated (Vitest).

[Unreleased]: https://github.com/bthos/azure-devops-wiki-editor/compare/v3.1.0...HEAD
[3.1.0]: https://github.com/bthos/azure-devops-wiki-editor/compare/v3.0.1...v3.1.0
[3.0.1]: https://github.com/bthos/azure-devops-wiki-editor/releases/tag/v3.0.1
