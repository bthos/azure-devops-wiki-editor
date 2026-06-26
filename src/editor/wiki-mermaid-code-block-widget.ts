import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';

import { wikiCodeBlockEditMetaKey } from './wiki-code-block-context';
import { createWikiBlockWidgetShell, createWikiWidgetToolbarButton } from './wiki-block-widget-dom';
import { WIKI_EDITOR_DARK_CLASS, WIKI_EDITOR_ROOT_ID } from './wiki-editor-dom';
import { renderMermaidSvg } from './wiki-mermaid-render';

function wikiEditorShellIsDark(view: EditorView): boolean {
    const root = view.dom.closest(`#${WIKI_EDITOR_ROOT_ID}`);
    return root?.classList.contains(WIKI_EDITOR_DARK_CLASS) ?? false;
}

/**
 * `code_block` with `params === 'mermaid'`: ADO wiki `::: mermaid` … `:::` (fenced ```mermaid still parses) — Mermaid preview + edit source.
 */
export function createMermaidCodeBlockNodeView(node: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
    let editing = false;
    let textarea: HTMLTextAreaElement | null = null;
    let renderGen = 0;

    const { dom, buttonGroup, mainContainer: preview, codeBody } = createWikiBlockWidgetShell({
        widgetClass: 'ado-mermaid-widget',
        role: 'region',
        ariaLabel: 'Mermaid diagram',
        titleText: 'Mermaid',
        titleClass: 'ado-mermaid-title',
        main: { kind: 'code-body-preview', previewClass: 'ado-mermaid-preview' },
    });
    const body = codeBody!;

    const editBtn = createWikiWidgetToolbarButton('edit', {
        title: 'Edit diagram source',
        ariaLabel: 'Edit diagram source',
    });
    const saveBtn = createWikiWidgetToolbarButton('save', {
        title: 'Save diagram',
        ariaLabel: 'Save diagram',
        initiallyHidden: true,
    });
    const cancelBtn = createWikiWidgetToolbarButton('cancel', {
        title: 'Cancel editing',
        ariaLabel: 'Cancel editing',
        initiallyHidden: true,
    });
    const deleteBtn = createWikiWidgetToolbarButton('delete', {
        title: 'Remove diagram',
        ariaLabel: 'Remove diagram',
    });

    buttonGroup.append(editBtn, saveBtn, cancelBtn, deleteBtn);

    function setEditMode(on: boolean) {
        editing = on;
        dom.classList.toggle('ado-mermaid-widget-editing', on);
        editBtn.style.display = on ? 'none' : '';
        deleteBtn.style.display = on ? 'none' : '';
        saveBtn.style.display = on ? '' : 'none';
        cancelBtn.style.display = on ? '' : 'none';
    }

    async function paintPreview(n: PMNode) {
        const gen = ++renderGen;
        const source = n.textContent;
        preview.replaceChildren();
        const loading = document.createElement('p');
        loading.className = 'wiki-mermaid-loading';
        loading.textContent = 'Rendering diagram…';
        preview.appendChild(loading);

        const isDark = wikiEditorShellIsDark(view);
        const out = await renderMermaidSvg(source, isDark);
        if (gen !== renderGen) return;

        preview.replaceChildren();
        if ('error' in out) {
            const err = document.createElement('div');
            err.className = 'wiki-mermaid-error';
            err.setAttribute('role', 'alert');
            err.textContent = out.error;
            preview.appendChild(err);
            const hint = document.createElement('pre');
            hint.className = 'ado-mermaid-code';
            hint.textContent = source;
            preview.appendChild(hint);
            return;
        }
        const host = document.createElement('div');
        host.className = 'wiki-mermaid-svg-host';
        host.innerHTML = out.svg;
        preview.appendChild(host);
    }

    function enterEdit() {
        const pos = getPos();
        if (pos === undefined) return;
        const n = view.state.doc.nodeAt(pos);
        if (!n || n.type.name !== 'code_block') return;

        setEditMode(true);
        renderGen += 1;
        preview.remove();

        textarea = document.createElement('textarea');
        textarea.className = 'ado-code-textarea';
        textarea.value = n.textContent;
        textarea.setAttribute('spellcheck', 'false');
        textarea.setAttribute('aria-label', 'Mermaid source');
        body.appendChild(textarea);
        textarea.focus();
    }

    function exitEdit() {
        if (!editing) return;
        setEditMode(false);
        textarea?.remove();
        textarea = null;
        if (!body.contains(preview)) {
            body.appendChild(preview);
        }
        const pos = getPos();
        const n = pos !== undefined ? view.state.doc.nodeAt(pos) : null;
        if (n && n.type.name === 'code_block' && String(n.attrs['params'] ?? '').trim().toLowerCase() === 'mermaid') {
            void paintPreview(n);
        }
    }

    function saveEdit() {
        if (!editing || !textarea) return;
        const pos = getPos();
        if (pos === undefined) return;
        const n = view.state.doc.nodeAt(pos);
        if (!n || n.type.name !== 'code_block') return;

        const text = view.state.schema.text(textarea.value);
        const next = n.type.create({ ...n.attrs, params: 'mermaid' }, text);
        view.dispatch(
            view.state.tr.replaceWith(pos, pos + n.nodeSize, next).setMeta(wikiCodeBlockEditMetaKey, true).scrollIntoView(),
        );
        exitEdit();
        view.focus();
    }

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

    void paintPreview(node);

    /** Clicks on preview/SVG do not map to doc coords like TOC; select the block explicitly (see PM `MouseDown.up` + `posAtCoords`). */
    function onMouseDown(e: MouseEvent) {
        if (e.button !== 0 || editing) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const target = e.target as Element | null;
        if (!target || !dom.contains(target)) return;
        if (target.closest?.('button, textarea, input, select')) return;

        const pos = getPos();
        if (pos === undefined) return;
        const pmNode = view.state.doc.nodeAt(pos);
        if (!pmNode || pmNode.type.name !== 'code_block' || String(pmNode.attrs['params'] ?? '').trim().toLowerCase() !== 'mermaid') {
            return;
        }
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
            if (updated.type.name !== 'code_block') return false;
            if (String(updated.attrs['params'] ?? '').trim().toLowerCase() !== 'mermaid') return false;
            if (!editing) {
                void paintPreview(updated);
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
        ignoreMutation: () => true,
        destroy() {
            renderGen += 1;
            dom.removeEventListener('mousedown', onMouseDown);
        },
    };
}
