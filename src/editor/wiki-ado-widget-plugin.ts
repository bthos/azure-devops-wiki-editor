import type { Node as PMNode } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';

import { adoWikiHeadingAnchorsFromPlainTexts, fetchChildPages, getWikiInfoFromUrl, renderTospChildListHtml } from '../ado-wiki-api';
import { buildTocHtml, type HeadingInfo } from '../syntax/ado-toc-node';
import { openWikiPasteHtmlDialog } from './wiki-paste-html-dialog';
import { sanitizeWikiHtml } from './wiki-html-sanitize';

function headingsFromWikiDoc(doc: PMNode): HeadingInfo[] {
    const levels: number[] = [];
    const texts: string[] = [];
    doc.descendants((node) => {
        if (node.type.name === 'heading') {
            levels.push(node.attrs['level'] as number);
            texts.push(node.textContent);
        }
    });
    const parts = adoWikiHeadingAnchorsFromPlainTexts(texts);
    return levels.map((level, i) => ({
        level,
        text: texts[i] ?? '',
        fragment: parts[i]?.fragment ?? '',
    }));
}

function createAdoTocNodeView(_node: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
    const dom = document.createElement('div');
    dom.className = 'ado-toc-widget';
    dom.contentEditable = 'false';
    dom.setAttribute('role', 'navigation');
    dom.setAttribute('aria-label', 'Table of contents');

    const header = document.createElement('div');
    header.className = 'ado-widget-header';

    const title = document.createElement('span');
    title.className = 'ado-toc-title';
    title.textContent = 'Contents';
    header.appendChild(title);

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ado-widget-buttons';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'ado-widget-refresh';
    refreshBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
    </svg>`;
    refreshBtn.title = 'Refresh Table of Contents';
    refreshBtn.type = 'button';
    refreshBtn.setAttribute('aria-label', 'Refresh Table of Contents');
    buttonGroup.appendChild(refreshBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ado-widget-delete';
    deleteBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
      <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>`;
    deleteBtn.title = 'Remove Table of Contents';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'Remove Table of Contents');
    buttonGroup.appendChild(deleteBtn);

    header.appendChild(buttonGroup);
    dom.appendChild(header);

    const content = document.createElement('div');
    content.className = 'ado-toc-content';
    dom.appendChild(content);

    const updateHeadings = () => {
        content.innerHTML = buildTocHtml(headingsFromWikiDoc(view.state.doc));
    };

    refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateHeadings();
    });

    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        if (pos !== undefined) {
            view.dispatch(view.state.tr.delete(pos, pos + 1));
            view.focus();
        }
    });

    updateHeadings();

    return {
        dom,
        update(updated) {
            if (updated.type.name !== 'ado_toc') return false;
            updateHeadings();
            return true;
        },
        destroy() {},
        ignoreMutation: () => true,
    };
}

function createAdoTospNodeView(_node: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
    const dom = document.createElement('div');
    dom.className = 'ado-tosp-widget';
    dom.contentEditable = 'false';
    dom.setAttribute('aria-label', 'Table of sub-pages');

    const header = document.createElement('div');
    header.className = 'ado-widget-header';

    const title = document.createElement('span');
    title.className = 'ado-tosp-title';
    title.textContent = 'Child Pages';
    header.appendChild(title);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ado-widget-delete';
    deleteBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
      <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>`;
    deleteBtn.title = 'Remove Child Pages';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'Remove Child Pages');
    header.appendChild(deleteBtn);

    dom.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ado-tosp-content';
    const placeholder = document.createElement('div');
    placeholder.className = 'ado-tosp-placeholder';
    placeholder.textContent = 'Loading child pages…';
    body.appendChild(placeholder);
    dom.appendChild(body);

    const ac = new AbortController();
    const wikiInfo = getWikiInfoFromUrl();
    if (!wikiInfo) {
        placeholder.textContent = 'Child pages are available only on wiki pages.';
    } else {
        fetchChildPages(wikiInfo, ac.signal)
            .then((pages) => {
                body.innerHTML = renderTospChildListHtml(pages, wikiInfo);
            })
            .catch((err) => {
                if ((err as Error)?.name === 'AbortError') return;
                placeholder.textContent = 'Could not load child pages.';
            });
    }

    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        if (pos !== undefined) {
            view.dispatch(view.state.tr.delete(pos, pos + 1));
            view.focus();
        }
    });

    return {
        dom,
        update(updated) {
            return updated.type.name === 'ado_tosp';
        },
        destroy() {
            ac.abort();
        },
        ignoreMutation: () => true,
    };
}

function createAdoHtmlInlineNodeView(node: PMNode): NodeView {
    const dom = document.createElement('span');
    dom.className = 'ado-html-inline';
    dom.contentEditable = 'false';
    dom.setAttribute('role', 'presentation');

    const paint = (n: PMNode) => {
        dom.innerHTML = sanitizeWikiHtml(String(n.attrs['html'] ?? ''));
    };
    paint(node);

    return {
        dom,
        update(updated) {
            if (updated.type.name !== 'ado_html_inline') return false;
            paint(updated);
            return true;
        },
        ignoreMutation: () => true,
    };
}

function createAdoHtmlBlockNodeView(initial: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
    const dom = document.createElement('div');
    dom.className = 'ado-html-widget';
    dom.contentEditable = 'false';
    dom.setAttribute('role', 'region');
    dom.setAttribute('aria-label', 'Embedded HTML');

    const header = document.createElement('div');
    header.className = 'ado-widget-header';

    const title = document.createElement('span');
    title.className = 'ado-html-title';
    title.textContent = 'HTML';
    header.appendChild(title);

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ado-widget-buttons';

    const editBtn = document.createElement('button');
    editBtn.className = 'ado-widget-edit';
    editBtn.type = 'button';
    editBtn.title = 'Edit HTML';
    editBtn.setAttribute('aria-label', 'Edit HTML');
    editBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
    </svg>`;
    buttonGroup.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ado-widget-delete';
    deleteBtn.type = 'button';
    deleteBtn.title = 'Remove HTML block';
    deleteBtn.setAttribute('aria-label', 'Remove HTML block');
    deleteBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
      <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>`;
    buttonGroup.appendChild(deleteBtn);
    header.appendChild(buttonGroup);
    dom.appendChild(header);

    const content = document.createElement('div');
    content.className = 'ado-html-content';
    dom.appendChild(content);

    let storedHtml = String(initial.attrs['html'] ?? '');

    const paint = () => {
        content.innerHTML = sanitizeWikiHtml(storedHtml);
    };

    paint();

    editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void openWikiPasteHtmlDialog({ title: 'Edit HTML', initialHtml: storedHtml }).then((raw) => {
            if (raw === null) return;
            const pos = getPos();
            if (pos === undefined) return;
            const next = sanitizeWikiHtml(raw);
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { html: next }).scrollIntoView());
            view.focus();
        });
    });

    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        if (pos !== undefined) {
            view.dispatch(view.state.tr.delete(pos, pos + 1));
            view.focus();
        }
    });

    return {
        dom,
        update(updated) {
            if (updated.type.name !== 'ado_html_block') return false;
            const next = String(updated.attrs['html'] ?? '');
            if (next !== storedHtml) {
                storedHtml = next;
                paint();
            }
            return true;
        },
        destroy() {},
        ignoreMutation: () => true,
    };
}

/**
 * Rich node views for `ado_toc` / `ado_tosp` / `ado_html_block` (same DOM as Milkdown {@link ../syntax/ado-toc-node.ts} widgets where applicable).
 */
export function wikiAdoWidgetPlugin(): Plugin {
    return new Plugin({
        props: {
            nodeViews: {
                ado_toc: (node, view, getPos) => createAdoTocNodeView(node, view, getPos),
                ado_tosp: (node, view, getPos) => createAdoTospNodeView(node, view, getPos),
                ado_html_block: (node, view, getPos) => createAdoHtmlBlockNodeView(node, view, getPos),
                ado_html_inline: (node) => createAdoHtmlInlineNodeView(node),
            },
        },
    });
}
