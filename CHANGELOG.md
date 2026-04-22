# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.1.0] - 2026-04-21

### Added

- **WikiEditor (ProseMirror)** as the default WYSIWYG surface (`src/editor/`, `main.ts`): markdown-it + `prosemirror-markdown` schema, tables, task lists, TOC/TOSP/HTML atoms, code block widget, heading anchors, attachment paste/display, wiki toolbar. Milkdown remains optional (popup / `?milkdown=1`).
- **ProseMirror toolbar — text & highlight colors**  
  - One **Text & highlight colors** dropdown with two native `<input type="color">` controls (foreground + background).  
  - Applies the `wikiStyle` mark (`src/editor/wiki-schema.ts`): serializes to raw wiki HTML `<span style="color:…;background-color:…">` and round-trips through `markdown-it` `html_inline` without using `ado_html_inline` atoms.  
  - Reset actions: clear text color, clear highlight, reset both (`applyWikiStyle` in `src/editor/wiki-insert-markers.ts`).  
- **Contributor doc:** [`docs/wiki-editor.md`](docs/wiki-editor.md) — DOM contract (`wiki-editor-root`, …), `wikiStyle` behavior, file map.
- **Unit tests** for wiki markdown, tables, task lists, heading anchors, hosts, mention service, and related helpers (`tests/unit/wiki-*.spec.ts`, …).

### Changed

- **WYSIWYG DOM / CSS naming** (default ProseMirror path and shared theme): replaced `milkdown-*` host class/id names with `wiki-editor-root`, `wiki-editor-shell`, `wiki-editor-toolbar`, and `wiki-editor-dark` (`src/editor/wiki-editor-dom.ts`, `public/custom-styles.css`, `src/theme/ado-theme.css`, `src/toolbar/toolbar.css`). Optional Milkdown bundle uses the same shell class via `ado-theme.ts` so styling stays aligned.  
- **Robot E2E** selectors updated to `.wiki-editor-shell` / `.wiki-editor-toolbar` (`tests/robot/…`, `MilkdownHelper.py`).
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
