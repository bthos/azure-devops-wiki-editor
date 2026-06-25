import type { Node as PMNode } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';

import { renderWikiMathKatex, WIKI_MATH_MAX_TEX_CHARS } from './wiki-math-katex';
import { createWikiBlockWidgetShell, createWikiWidgetToolbarButton } from './wiki-block-widget-dom';

function paintMathContent(container: HTMLElement, n: PMNode, display: boolean) {
    const tex = String(n.attrs['tex'] ?? '');
    container.replaceChildren();
    const out = renderWikiMathKatex(tex, display);
    if (out.ok && out.html) {
        container.innerHTML = out.html;
        return;
    }
    const err = document.createElement('span');
    err.className = 'wiki-math-error';
    err.title = out.ok ? 'Empty math' : out.message;
    err.textContent = tex.length > 200 ? `${tex.slice(0, 200)}…` : tex || '(empty)';
    container.appendChild(err);
}

function capTexForSave(raw: string): string {
    const t = raw.replace(/\r\n/g, '\n');
    if (t.length <= WIKI_MATH_MAX_TEX_CHARS) return t;
    return t.slice(0, WIKI_MATH_MAX_TEX_CHARS);
}

function createMathNodeView(display: boolean): (node: PMNode, view: EditorView, getPos: () => number | undefined) => NodeView {
    return function mathNodeView(node: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
        if (!display) {
            const dom = document.createElement('span');
            dom.className = 'wiki-math-inline-view';
            dom.setAttribute('role', 'math');
            dom.contentEditable = 'false';

            paintMathContent(dom, node, false);

            return {
                dom,
                update(updated) {
                    if (updated.type.name !== 'wiki_math_inline') return false;
                    paintMathContent(dom, updated, false);
                    return true;
                },
            };
        }

        let editing = false;
        let textarea: HTMLTextAreaElement | null = null;

        const { dom, buttonGroup, mainContainer: body } = createWikiBlockWidgetShell({
            widgetClass: 'ado-math-widget',
            role: 'region',
            ariaLabel: 'Formula',
            titleText: 'Formula',
            titleClass: 'ado-math-title',
            main: { kind: 'direct', contentClass: 'ado-math-body' },
        });

        const editBtn = createWikiWidgetToolbarButton('edit', {
            title: 'Edit LaTeX source',
            ariaLabel: 'Edit LaTeX source',
        });
        const saveBtn = createWikiWidgetToolbarButton('save', {
            title: 'Save formula',
            ariaLabel: 'Save formula',
            initiallyHidden: true,
        });
        const cancelBtn = createWikiWidgetToolbarButton('cancel', {
            title: 'Cancel editing',
            ariaLabel: 'Cancel editing',
            initiallyHidden: true,
        });
        const deleteBtn = createWikiWidgetToolbarButton('delete', {
            title: 'Remove formula',
            ariaLabel: 'Remove formula',
        });

        buttonGroup.append(editBtn, saveBtn, cancelBtn, deleteBtn);

        paintMathContent(body, node, true);

        function setEditMode(on: boolean) {
            editing = on;
            dom.classList.toggle('ado-math-widget-editing', on);
            editBtn.style.display = on ? 'none' : '';
            deleteBtn.style.display = on ? 'none' : '';
            saveBtn.style.display = on ? '' : 'none';
            cancelBtn.style.display = on ? '' : 'none';
        }

        function enterEdit() {
            const pos = getPos();
            if (pos === undefined) return;
            const n = view.state.doc.nodeAt(pos);
            if (!n || n.type.name !== 'wiki_math_block') return;

            setEditMode(true);
            body.replaceChildren();
            textarea = document.createElement('textarea');
            textarea.className = 'ado-code-textarea';
            textarea.value = String(n.attrs['tex'] ?? '');
            textarea.setAttribute('spellcheck', 'false');
            textarea.setAttribute('aria-label', 'LaTeX source');
            body.appendChild(textarea);
            textarea.focus();
        }

        function exitEdit() {
            if (!editing) return;
            setEditMode(false);
            textarea?.remove();
            textarea = null;
            const pos = getPos();
            const n = pos !== undefined ? view.state.doc.nodeAt(pos) : null;
            if (n && n.type.name === 'wiki_math_block') {
                paintMathContent(body, n, true);
            }
        }

        function saveEdit() {
            if (!editing || !textarea) return;
            const pos = getPos();
            if (pos === undefined) return;
            const n = view.state.doc.nodeAt(pos);
            if (!n || n.type.name !== 'wiki_math_block') return;

            const tex = capTexForSave(textarea.value);
            const next = n.type.create({ ...n.attrs, tex }, null);
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
            const current = pos !== undefined ? view.state.doc.nodeAt(pos) : null;
            if (pos !== undefined && current) {
                view.dispatch(view.state.tr.delete(pos, pos + current.nodeSize).scrollIntoView());
                view.focus();
            }
        });

        return {
            dom,
            update(updated) {
                if (updated.type.name !== 'wiki_math_block') return false;
                if (!editing) {
                    paintMathContent(body, updated, true);
                }
                return true;
            },
            selectNode() {
                dom.classList.add('ProseMirror-selectednode');
            },
            deselectNode() {
                dom.classList.remove('ProseMirror-selectednode');
            },
            stopEvent(event) {
                const t = event.target as Node | null;
                if (!t || !dom.contains(t)) return false;
                if (editing) return true;
                if ((t as Element).closest?.('button')) return true;
                return false;
            },
            ignoreMutation: () => true,
        };
    };
}

/** KaTeX-backed previews for `wiki_math_inline` / `wiki_math_block` (stylesheet loaded via extension manifest). */
export function wikiMathWidgetPlugin(): Plugin {
    return new Plugin({
        props: {
            nodeViews: {
                wiki_math_inline: createMathNodeView(false),
                wiki_math_block: createMathNodeView(true),
            },
        },
    });
}
