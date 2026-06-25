import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, Plugin } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';

import { createWikiBlockWidgetShell, createWikiWidgetToolbarButton } from './wiki-block-widget-dom';
import { normalizeWikiVideoEmbedInput, WIKI_VIDEO_IFRAME_PLACEHOLDER } from './wiki-video-url';

function paintVideoPreview(container: HTMLElement, body: string) {
    container.replaceChildren();

    const safe = normalizeWikiVideoEmbedInput(String(body ?? '').trim());
    if (!safe) {
        const ph = document.createElement('div');
        ph.className = 'ado-video-placeholder';
        ph.textContent = WIKI_VIDEO_IFRAME_PLACEHOLDER;
        container.appendChild(ph);
        return;
    }

    const stack = document.createElement('div');
    stack.className = 'ado-video-preview-stack';

    const wrap = document.createElement('div');
    wrap.className = 'ado-video-media';
    const iframe = document.createElement('iframe');
    iframe.className = 'ado-video-iframe';
    iframe.src = safe;
    iframe.title = 'Embedded video';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    );
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox',
    );
    wrap.appendChild(iframe);
    stack.appendChild(wrap);

    const linkRow = document.createElement('div');
    linkRow.className = 'ado-video-footer';

    const urlSpan = document.createElement('span');
    urlSpan.className = 'ado-video-url';
    const display = safe.length > 120 ? `${safe.slice(0, 117)}…` : safe;
    urlSpan.textContent = display;
    urlSpan.title = safe;

    const open = document.createElement('a');
    open.className = 'ado-video-open-link';
    open.href = safe;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Open';

    linkRow.append(urlSpan, open);
    stack.appendChild(linkRow);
    container.appendChild(stack);
}

function createAdoVideoBlockNodeView(node: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
    let editing = false;
    let textarea: HTMLTextAreaElement | null = null;

    const { dom, buttonGroup, mainContainer: preview, codeBody } = createWikiBlockWidgetShell({
        widgetClass: 'ado-video-widget',
        role: 'region',
        ariaLabel: 'Video embed',
        titleText: 'Video',
        titleClass: 'ado-video-title',
        main: { kind: 'code-body-preview', previewClass: 'ado-video-preview' },
    });
    const body = codeBody!;

    const editBtn = createWikiWidgetToolbarButton('edit', {
        title: 'Edit iframe embed URL',
        ariaLabel: 'Edit iframe embed URL',
    });
    const saveBtn = createWikiWidgetToolbarButton('save', {
        title: 'Save embed',
        ariaLabel: 'Save embed',
        initiallyHidden: true,
    });
    const cancelBtn = createWikiWidgetToolbarButton('cancel', {
        title: 'Cancel editing',
        ariaLabel: 'Cancel editing',
        initiallyHidden: true,
    });
    const deleteBtn = createWikiWidgetToolbarButton('delete', {
        title: 'Remove video embed',
        ariaLabel: 'Remove video embed',
    });

    buttonGroup.append(editBtn, saveBtn, cancelBtn, deleteBtn);

    function setEditMode(on: boolean) {
        editing = on;
        dom.classList.toggle('ado-video-widget-editing', on);
        editBtn.style.display = on ? 'none' : '';
        deleteBtn.style.display = on ? 'none' : '';
        saveBtn.style.display = on ? '' : 'none';
        cancelBtn.style.display = on ? '' : 'none';
    }

    function enterEdit() {
        const pos = getPos();
        if (pos === undefined) return;
        const n = view.state.doc.nodeAt(pos);
        if (!n || n.type.name !== 'ado_video_block') return;

        setEditMode(true);
        preview.remove();

        textarea = document.createElement('textarea');
        textarea.className = 'ado-code-textarea';
        textarea.value = String(n.attrs['body'] ?? '');
        textarea.setAttribute('spellcheck', 'false');
        textarea.setAttribute('aria-label', 'Iframe embed URL or full iframe HTML');
        textarea.setAttribute('placeholder', WIKI_VIDEO_IFRAME_PLACEHOLDER);
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
        if (n && n.type.name === 'ado_video_block') {
            paintVideoPreview(preview, String(n.attrs['body'] ?? ''));
        }
    }

    function saveEdit() {
        if (!editing || !textarea) return;
        const pos = getPos();
        if (pos === undefined) return;
        const n = view.state.doc.nodeAt(pos);
        if (!n || n.type.name !== 'ado_video_block') return;

        const body = textarea.value.replace(/\r\n/g, '\n').trim();
        const next = n.type.create({ body });
        view.dispatch(view.state.tr.replaceWith(pos, pos + n.nodeSize, next).scrollIntoView());
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
        if (pos !== undefined) {
            const cur = view.state.doc.nodeAt(pos);
            const size = cur?.nodeSize ?? 1;
            view.dispatch(view.state.tr.delete(pos, pos + size).scrollIntoView());
            view.focus();
        }
    });

    function onMouseDown(e: MouseEvent) {
        if (e.button !== 0 || editing) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const target = e.target as Element | null;
        if (!target || !dom.contains(target)) return;
        if (target.closest?.('button, textarea, input, select, a, iframe')) return;

        const pos = getPos();
        if (pos === undefined) return;
        const pmNode = view.state.doc.nodeAt(pos);
        if (!pmNode || pmNode.type.name !== 'ado_video_block') return;
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

    paintVideoPreview(preview, String(node.attrs['body'] ?? ''));

    return {
        dom,
        selectNode() {
            dom.classList.add('ProseMirror-selectednode');
        },
        deselectNode() {
            dom.classList.remove('ProseMirror-selectednode');
        },
        update(updated) {
            if (updated.type.name !== 'ado_video_block') return false;
            if (!editing) {
                paintVideoPreview(preview, String(updated.attrs['body'] ?? ''));
            }
            return true;
        },
        stopEvent(event) {
            const t = event.target as Node | null;
            if (!t || !dom.contains(t)) return false;
            if ((t as Element).closest?.('button, textarea, iframe')) return true;
            return false;
        },
        ignoreMutation: () => true,
        destroy() {
            dom.removeEventListener('mousedown', onMouseDown);
        },
    };
}

/** Node view for {@link wikiSchema} `ado_video_block` (`::: video` … `:::`). */
export function wikiVideoWidgetPlugin(): Plugin {
    return new Plugin({
        props: {
            nodeViews: {
                ado_video_block: (node, view, getPos) => createAdoVideoBlockNodeView(node, view, getPos),
            },
        },
    });
}
