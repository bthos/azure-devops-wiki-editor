# Wiki WYSIWYG editor (ProseMirror)

The content script mounts a **ProseMirror-based** wiki editor by default (`WikiEditor`). An optional **Milkdown** bundle remains available for comparison (`?milkdown=1` or the extension popup).

## DOM contract

Shared constants live in `src/editor/wiki-editor-dom.ts`:

| Constant | Value | Role |
| -------- | ----- | ---- |
| `WIKI_EDITOR_ROOT_ID` | `wiki-editor-root` | Host container injected next to the ADO textarea when WYSIWYG is on |
| `WIKI_EDITOR_SHELL_CLASS` | `wiki-editor-shell` | Inner wrapper around the toolbar + `.editor` + `.ProseMirror` |
| `WIKI_EDITOR_TOOLBAR_CLASS` | `wiki-editor-toolbar` | Toolbar row |
| `WIKI_EDITOR_DARK_CLASS` | `wiki-editor-dark` | Applied to the root when ADO theme is dark |

CSS for the host lives in `public/custom-styles.css` and `src/theme/ado-theme.css` (selectors use the names above, not `milkdown-*`).

## Inline text & highlight (`wikiStyle`)

Colored text and optional highlight use a single ProseMirror **mark** `wikiStyle` with attrs:

- `color` — foreground hex (`#rrggbb` / normalized from `#rgb`)
- `backgroundColor` — highlight hex

Markdown round-trip writes **one** raw HTML span, for example:

```html
<span style="color:#c00000;background-color:#ffffcc">text</span>
```

Only `color` and/or `background-color` declarations are accepted when parsing `html_inline` tokens; anything else stays an `ado_html_inline` atom.

Toolbar: **Text & highlight colors** dropdown (`wiki-pm-toolbar-html` + `wiki-toolbar.ts`) with two native `<input type="color">` pickers and reset actions (`applyWikiStyle` in `wiki-insert-markers.ts`).

## Related files

| Area | Path |
| ---- | ---- |
| Schema | `src/editor/wiki-schema.ts` |
| Hex / style parsing | `src/editor/wiki-text-color.ts` |
| Markdown parser patch | `src/editor/wiki-markdown-parser.ts` |
| Markdown serializer | `src/editor/wiki-markdown-serializer.ts` |
| Toolbar | `src/editor/wiki-toolbar.ts`, `src/editor/wiki-pm-toolbar-html.ts`, `src/toolbar/toolbar.css` |
