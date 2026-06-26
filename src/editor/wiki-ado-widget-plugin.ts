import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, Plugin } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';

import { adoWikiHeadingAnchorsFromPlainTexts, fetchChildPages, getWikiInfoFromUrl, renderTospChildListHtml } from '../ado-wiki-api';
import { buildTocHtml, type HeadingInfo } from '../syntax/ado-toc-html';
import { createWikiBlockWidgetShell, createWikiWidgetToolbarButton } from './wiki-block-widget-dom';
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
    const { dom, buttonGroup, mainContainer: content } = createWikiBlockWidgetShell({
        widgetClass: 'ado-toc-widget',
        role: 'navigation',
        ariaLabel: 'Table of contents',
        titleText: 'Contents',
        titleClass: 'ado-toc-title',
        main: { kind: 'direct', contentClass: 'ado-toc-content' },
    });

    const refreshBtn = createWikiWidgetToolbarButton('refresh', {
        title: 'Refresh Table of Contents',
        ariaLabel: 'Refresh Table of Contents',
    });
    const deleteBtn = createWikiWidgetToolbarButton('delete', {
        title: 'Remove Table of Contents',
        ariaLabel: 'Remove Table of Contents',
    });
    buttonGroup.append(refreshBtn, deleteBtn);

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
    const { dom, buttonGroup, mainContainer: body } = createWikiBlockWidgetShell({
        widgetClass: 'ado-tosp-widget',
        role: 'region',
        ariaLabel: 'Table of sub-pages',
        titleText: 'Child Pages',
        titleClass: 'ado-tosp-title',
        main: { kind: 'direct', contentClass: 'ado-tosp-content' },
    });

    const deleteBtn = createWikiWidgetToolbarButton('delete', {
        title: 'Remove Child Pages',
        ariaLabel: 'Remove Child Pages',
    });
    buttonGroup.appendChild(deleteBtn);

    const placeholder = document.createElement('div');
    placeholder.className = 'ado-tosp-placeholder';
    placeholder.textContent = 'Loading child pages…';
    body.appendChild(placeholder);

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
    let editing = false;
    let textarea: HTMLTextAreaElement | null = null;
    let editorWrap: HTMLDivElement | null = null;

    const { dom, buttonGroup, mainContainer: content } = createWikiBlockWidgetShell({
        widgetClass: 'ado-html-widget',
        role: 'region',
        ariaLabel: 'Embedded HTML',
        titleText: 'HTML',
        titleClass: 'ado-html-title',
        main: { kind: 'direct', contentClass: 'ado-html-content' },
    });

    const editBtn = createWikiWidgetToolbarButton('edit', {
        title: 'Edit HTML source',
        ariaLabel: 'Edit HTML source',
    });
    const saveBtn = createWikiWidgetToolbarButton('save', {
        title: 'Save HTML',
        ariaLabel: 'Save HTML',
        initiallyHidden: true,
    });
    const cancelBtn = createWikiWidgetToolbarButton('cancel', {
        title: 'Cancel editing',
        ariaLabel: 'Cancel editing',
        initiallyHidden: true,
    });
    const deleteBtn = createWikiWidgetToolbarButton('delete', {
        title: 'Remove HTML block',
        ariaLabel: 'Remove HTML block',
    });

    buttonGroup.append(editBtn, saveBtn, cancelBtn, deleteBtn);

    let storedHtml = String(initial.attrs['html'] ?? '');

    const paint = () => {
        content.innerHTML = sanitizeWikiHtml(storedHtml);
    };

    function setEditMode(on: boolean) {
        editing = on;
        dom.classList.toggle('ado-html-widget-editing', on);
        editBtn.style.display = on ? 'none' : '';
        deleteBtn.style.display = on ? 'none' : '';
        saveBtn.style.display = on ? '' : 'none';
        cancelBtn.style.display = on ? '' : 'none';
        content.style.display = on ? 'none' : '';
    }

    function enterEdit() {
        const pos = getPos();
        if (pos === undefined) return;
        const n = view.state.doc.nodeAt(pos);
        if (!n || n.type.name !== 'ado_html_block') return;

        setEditMode(true);
        editorWrap = document.createElement('div');
        editorWrap.className = 'ado-html-editor';
        textarea = document.createElement('textarea');
        textarea.className = 'ado-html-textarea';
        textarea.value = storedHtml;
        textarea.setAttribute('spellcheck', 'false');
        textarea.setAttribute('aria-label', 'HTML source');
        editorWrap.appendChild(textarea);
        dom.appendChild(editorWrap);
        textarea.focus();
    }

    function exitEdit() {
        if (!editing) return;
        setEditMode(false);
        editorWrap?.remove();
        editorWrap = null;
        textarea = null;
        paint();
    }

    function saveEdit() {
        if (!editing || !textarea) return;
        const pos = getPos();
        if (pos === undefined) return;
        const nextHtml = sanitizeWikiHtml(textarea.value);
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { html: nextHtml }).scrollIntoView());
        storedHtml = nextHtml;
        exitEdit();
        view.focus();
    }

    paint();

    editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        enterEdit();
    });

    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveEdit();
    });

    cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        exitEdit();
        view.focus();
    });

    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        const n = pos !== undefined ? view.state.doc.nodeAt(pos) : null;
        if (pos !== undefined && n) {
            view.dispatch(view.state.tr.delete(pos, pos + n.nodeSize).scrollIntoView());
            view.focus();
        }
    });

    function onMouseDown(e: MouseEvent) {
        if (e.button !== 0 || editing) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const target = e.target as Element | null;
        if (!target || !dom.contains(target)) return;
        if (target.closest?.('button, textarea, input, select')) return;

        const pos = getPos();
        if (pos === undefined) return;
        const pmNode = view.state.doc.nodeAt(pos);
        if (!pmNode || pmNode.type.name !== 'ado_html_block') return;
        if (!NodeSelection.isSelectable(pmNode)) return;

        e.preventDefault();
        e.stopPropagation();
        const sel = NodeSelection.create(view.state.doc, pos);
        if (!view.state.selection.eq(sel)) {
            view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
        }
        view.focus();
    }

    dom.addEventListener('mousedown', onMouseDown);

    return {
        dom,
        selectNode() {
            dom.classList.add('ProseMirror-selectednode');
        },
        deselectNode() {
            dom.classList.remove('ProseMirror-selectednode');
        },
        update(updated) {
            if (updated.type.name !== 'ado_html_block') return false;
            const next = String(updated.attrs['html'] ?? '');
            if (!editing && next !== storedHtml) {
                storedHtml = next;
                paint();
            }
            return true;
        },
        stopEvent(event) {
            const t = event.target as Node | null;
            if (!t || !dom.contains(t)) return false;
            if (editing) return true;
            if ((t as Element).closest?.('button')) return true;
            return false;
        },
        destroy() {
            dom.removeEventListener('mousedown', onMouseDown);
        },
        ignoreMutation: () => true,
    };
}

/**
 * Rich node views for `ado_toc` / `ado_tosp` / `ado_html_block`.
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
