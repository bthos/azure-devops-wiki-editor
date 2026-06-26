/**
 * Shared DOM for ADO-style block widgets (TOC, code, Mermaid, math, HTML, video):
 * toolbar SVGs, header + button row, and optional main panel layouts.
 */

/** Pencil — same across code / Mermaid / HTML widgets. */
export const WIKI_WIDGET_EDIT_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
</svg>`;

export const WIKI_WIDGET_SAVE_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06l2.97 2.97 6.72-6.72a.75.75 0 011.06 0z"/>
</svg>`;

export const WIKI_WIDGET_CANCEL_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
</svg>`;

export const WIKI_WIDGET_DELETE_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
  <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
</svg>`;

export const WIKI_WIDGET_REFRESH_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
</svg>`;

/** Two-sheet copy — code block toolbar only. */
export const WIKI_WIDGET_COPY_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h2zm2-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H6zm-3 3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2V6a2 2 0 0 1 2-2h5V4a1 1 0 0 0-1-1H3z"/>
</svg>`;

export type WikiWidgetToolbarVariant = 'edit' | 'save' | 'cancel' | 'delete' | 'refresh' | 'copy';

const TOOLBAR_VARIANT_CLASS: Record<WikiWidgetToolbarVariant, string> = {
    edit: 'ado-widget-edit',
    save: 'ado-widget-edit',
    cancel: 'ado-widget-edit',
    delete: 'ado-widget-delete',
    refresh: 'ado-widget-refresh',
    copy: 'ado-widget-edit',
};

const TOOLBAR_VARIANT_SVG: Record<WikiWidgetToolbarVariant, string> = {
    edit: WIKI_WIDGET_EDIT_SVG,
    save: WIKI_WIDGET_SAVE_SVG,
    cancel: WIKI_WIDGET_CANCEL_SVG,
    delete: WIKI_WIDGET_DELETE_SVG,
    refresh: WIKI_WIDGET_REFRESH_SVG,
    copy: WIKI_WIDGET_COPY_SVG,
};

/**
 * Standard widget toolbar control (edit / save / cancel / delete / refresh / copy).
 * `save` / `cancel` start hidden — callers toggle like existing widgets.
 */
export function createWikiWidgetToolbarButton(
    variant: WikiWidgetToolbarVariant,
    opts: { title: string; ariaLabel: string; initiallyHidden?: boolean },
): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = TOOLBAR_VARIANT_CLASS[variant];
    b.title = opts.title;
    b.setAttribute('aria-label', opts.ariaLabel);
    b.innerHTML = TOOLBAR_VARIANT_SVG[variant];
    if (opts.initiallyHidden) {
        b.style.display = 'none';
    }
    return b;
}

/** Main panel: `code-body` > preview (Mermaid, video) or `code-body` > pre > code (code block), or a single div (TOC, HTML, math, TOSP). */
export type WikiBlockMainPanelSpec =
    | { kind: 'code-body-preview'; previewClass: string }
    | { kind: 'code-body-pre-code' }
    | { kind: 'direct'; contentClass: string };

export interface WikiBlockWidgetShell {
    dom: HTMLDivElement;
    header: HTMLDivElement;
    title: HTMLSpanElement;
    buttonGroup: HTMLDivElement;
    /**
     * Primary region for dynamic content: preview div, `ado-math-body`, `ado-html-content`, etc.,
     * or the inner `<code>` when {@link WikiBlockMainPanelSpec} is `code-body-pre-code`.
     */
    mainContainer: HTMLElement;
    /** Present when main panel uses `.ado-code-body` (Mermaid, video, code block). */
    codeBody: HTMLDivElement | null;
}

/**
 * Builds the common chrome: widget root, header (title + empty `.ado-widget-buttons`), main panel.
 * Append toolbar buttons to `buttonGroup`, then wire behavior in the caller.
 */
export function createWikiBlockWidgetShell(opts: {
    widgetClass: string;
    role: string;
    ariaLabel: string;
    titleText: string;
    titleClass: string;
    main: WikiBlockMainPanelSpec;
}): WikiBlockWidgetShell {
    const dom = document.createElement('div');
    dom.className = opts.widgetClass;
    dom.contentEditable = 'false';
    dom.setAttribute('role', opts.role);
    dom.setAttribute('aria-label', opts.ariaLabel);

    const header = document.createElement('div');
    header.className = 'ado-widget-header';

    const title = document.createElement('span');
    title.className = opts.titleClass;
    title.textContent = opts.titleText;

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ado-widget-buttons';

    header.append(title, buttonGroup);
    dom.appendChild(header);

    let mainContainer: HTMLElement;
    let codeBody: HTMLDivElement | null = null;

    switch (opts.main.kind) {
        case 'code-body-preview': {
            const body = document.createElement('div');
            body.className = 'ado-code-body';
            codeBody = body;
            const preview = document.createElement('div');
            preview.className = opts.main.previewClass;
            body.appendChild(preview);
            dom.appendChild(body);
            mainContainer = preview;
            break;
        }
        case 'code-body-pre-code': {
            const body = document.createElement('div');
            body.className = 'ado-code-body';
            codeBody = body;
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            pre.appendChild(code);
            body.appendChild(pre);
            dom.appendChild(body);
            mainContainer = code;
            break;
        }
        case 'direct': {
            const panel = document.createElement('div');
            panel.className = opts.main.contentClass;
            dom.appendChild(panel);
            mainContainer = panel;
            break;
        }
    }

    return { dom, header, title, buttonGroup, mainContainer, codeBody };
}
