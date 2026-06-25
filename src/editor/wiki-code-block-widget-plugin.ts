import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, Plugin } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';

import { selectionInsideCodeBlock, wikiCodeBlockEditMetaKey } from './wiki-code-block-context';
import { applyWikiCodeReadonlyHighlight, WIKI_CODE_HIGHLIGHT_LANGUAGES } from './wiki-code-highlight';
import { createWikiBlockWidgetShell, createWikiWidgetToolbarButton } from './wiki-block-widget-dom';
import { createMermaidCodeBlockNodeView } from './wiki-mermaid-code-block-widget';

let codeBlockLangInputSeq = 0;

/** Sorted unique language ids for the code-block editor combobox (no native `list` — avoids Chromium double-arrow). */
const CODE_BLOCK_LANG_SUGGESTIONS = Array.from(
    new Set<string>([
        'text',
        ...WIKI_CODE_HIGHLIGHT_LANGUAGES,
        'sql',
        'csharp',
        'dockerfile',
        'ini',
        'toml',
        'tsx',
        'jsx',
    ]),
).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

function filterCodeBlockLangSuggestions(query: string, limit = 72): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return CODE_BLOCK_LANG_SUGGESTIONS.slice(0, limit);
    return CODE_BLOCK_LANG_SUGGESTIONS.filter((lang) => lang.toLowerCase().includes(q)).slice(0, limit);
}

/** MV3 content script: prefer async clipboard; fall back for non-secure contexts. */
function writePlainTextToClipboard(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            ok ? resolve() : reject(new Error('execCommand copy failed'));
        } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
        }
    });
}

/** Strip characters that would break fenced markdown; cap length (fence info string). */
function sanitizeCodeFenceParams(raw: string): string {
    return raw
        .trim()
        .replace(/[\n\r\t`]/g, '')
        .slice(0, 64);
}

function isMermaidFenceParams(params: unknown): boolean {
    return String(params ?? '').trim().toLowerCase() === 'mermaid';
}

function createCodeBlockNodeView(node: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
    let editing = false;
    let textarea: HTMLTextAreaElement | null = null;
    let langInput: HTMLInputElement | null = null;

    const { dom, title, buttonGroup, mainContainer: codeEl, codeBody } = createWikiBlockWidgetShell({
        widgetClass: 'ado-code-widget',
        role: 'region',
        ariaLabel: 'Code block',
        titleText: 'Code',
        titleClass: 'ado-code-title',
        main: { kind: 'code-body-pre-code' },
    });
    const body = codeBody!;
    const pre = codeEl.parentElement as HTMLPreElement;

    const copyBtn = createWikiWidgetToolbarButton('copy', {
        title: 'Copy code',
        ariaLabel: 'Copy code',
    });
    const editBtn = createWikiWidgetToolbarButton('edit', {
        title: 'Edit code',
        ariaLabel: 'Edit code',
    });
    const saveBtn = createWikiWidgetToolbarButton('save', {
        title: 'Save code',
        ariaLabel: 'Save code',
        initiallyHidden: true,
    });
    const cancelBtn = createWikiWidgetToolbarButton('cancel', {
        title: 'Cancel editing',
        ariaLabel: 'Cancel editing',
        initiallyHidden: true,
    });
    const deleteBtn = createWikiWidgetToolbarButton('delete', {
        title: 'Remove code block',
        ariaLabel: 'Remove code block',
    });

    buttonGroup.append(copyBtn, editBtn, saveBtn, cancelBtn, deleteBtn);

    function setTitle(n: PMNode) {
        const params = String(n.attrs['params'] ?? '').trim();
        title.textContent = params ? `Code: ${params}` : 'Code';
    }

    function renderReadonly(n: PMNode) {
        setTitle(n);
        const params = String(n.attrs['params'] ?? '').trim();
        applyWikiCodeReadonlyHighlight(codeEl as HTMLElement, params, n.textContent);
    }

    function setEditMode(on: boolean) {
        editing = on;
        dom.classList.toggle('ado-code-widget-editing', on);
        editBtn.style.display = on ? 'none' : '';
        deleteBtn.style.display = on ? 'none' : '';
        saveBtn.style.display = on ? '' : 'none';
        cancelBtn.style.display = on ? '' : 'none';
    }

    function syncTitleFromLangInput() {
        const params = langInput?.value.trim() ?? '';
        title.textContent = params ? `Code: ${params}` : 'Code';
    }

    function enterEdit() {
        const pos = getPos();
        if (pos === undefined) return;
        const n = view.state.doc.nodeAt(pos);
        if (!n || n.type.name !== 'code_block') return;

        setEditMode(true);
        body.innerHTML = '';

        const langRow = document.createElement('div');
        langRow.className = 'ado-code-lang-row';

        const langLabel = document.createElement('label');
        langLabel.className = 'ado-code-lang-label';
        langLabel.setAttribute('for', `ado-code-lang-${codeBlockLangInputSeq}`);
        langLabel.textContent = 'Language';

        const combo = document.createElement('div');
        combo.className = 'ado-code-lang-combo';

        langInput = document.createElement('input');
        langInput.id = `ado-code-lang-${codeBlockLangInputSeq}`;
        codeBlockLangInputSeq += 1;
        langInput.className = 'ado-code-lang-input';
        langInput.type = 'text';
        langInput.setAttribute('spellcheck', 'false');
        langInput.setAttribute('autocomplete', 'off');
        langInput.setAttribute('aria-label', 'Code block language');
        langInput.setAttribute('placeholder', 'e.g. typescript, bash, json');
        langInput.value = String(n.attrs['params'] ?? '').trim();
        langInput.setAttribute('role', 'combobox');
        langInput.setAttribute('aria-autocomplete', 'list');
        langInput.setAttribute('aria-expanded', 'false');

        const suggestId = `${langInput.id}-suggest`;
        langInput.setAttribute('aria-controls', suggestId);

        const suggestPanel = document.createElement('div');
        suggestPanel.id = suggestId;
        suggestPanel.className = 'ado-code-lang-suggest';
        suggestPanel.setAttribute('role', 'listbox');
        suggestPanel.hidden = true;

        function paintSuggest() {
            const matches = filterCodeBlockLangSuggestions(langInput!.value);
            suggestPanel.replaceChildren();
            for (const lang of matches) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ado-code-lang-suggest-item';
                btn.setAttribute('role', 'option');
                btn.textContent = lang;
                btn.addEventListener('mousedown', (ev) => {
                    ev.preventDefault();
                    langInput!.value = lang;
                    syncTitleFromLangInput();
                    suggestPanel.hidden = true;
                    langInput!.setAttribute('aria-expanded', 'false');
                });
                suggestPanel.appendChild(btn);
            }
            const show = matches.length > 0;
            suggestPanel.hidden = !show;
            langInput!.setAttribute('aria-expanded', show ? 'true' : 'false');
        }

        function hideSuggest() {
            suggestPanel.hidden = true;
            langInput?.setAttribute('aria-expanded', 'false');
        }

        combo.append(langInput, suggestPanel);
        langRow.append(langLabel, combo);
        langInput.addEventListener('input', () => {
            syncTitleFromLangInput();
            paintSuggest();
        });
        langInput.addEventListener('focus', () => {
            paintSuggest();
        });
        langInput.addEventListener('blur', () => {
            window.setTimeout(() => {
                if (!combo.contains(document.activeElement)) hideSuggest();
            }, 0);
        });
        langInput.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
                hideSuggest();
            }
        });

        textarea = document.createElement('textarea');
        textarea.className = 'ado-code-textarea';
        textarea.value = n.textContent;
        textarea.setAttribute('spellcheck', 'false');
        textarea.setAttribute('aria-label', 'Code editor');
        textarea.addEventListener('focus', hideSuggest);

        body.append(langRow, textarea);
        syncTitleFromLangInput();
        textarea.focus();
    }

    function exitEdit() {
        if (!editing) return;
        setEditMode(false);
        textarea = null;
        langInput = null;
        body.innerHTML = '';
        body.appendChild(pre);
        const pos = getPos();
        const n = pos !== undefined ? view.state.doc.nodeAt(pos) : null;
        if (n && n.type.name === 'code_block') {
            renderReadonly(n);
        }
    }

    function saveEdit() {
        if (!editing || !textarea) return;
        const pos = getPos();
        if (pos === undefined) return;
        const n = view.state.doc.nodeAt(pos);
        if (!n || n.type.name !== 'code_block') return;

        const params = sanitizeCodeFenceParams(langInput?.value ?? '');
        const text = view.state.schema.text(textarea.value);
        const next = n.type.create({ ...n.attrs, params }, text);
        view.dispatch(
            view.state.tr.replaceWith(pos, pos + n.nodeSize, next).setMeta(wikiCodeBlockEditMetaKey, true).scrollIntoView(),
        );
        exitEdit();
        view.focus();
    }

    async function copyCodeBlockSource() {
        const pos = getPos();
        if (pos === undefined) return;
        const n = view.state.doc.nodeAt(pos);
        if (!n || n.type.name !== 'code_block') return;
        const source = editing && textarea ? textarea.value : n.textContent;
        const prevTitle = copyBtn.title;
        const prevLabel = copyBtn.getAttribute('aria-label') ?? '';
        try {
            await writePlainTextToClipboard(source);
            copyBtn.title = 'Copied';
            copyBtn.setAttribute('aria-label', 'Copied');
            window.setTimeout(() => {
                copyBtn.title = prevTitle;
                copyBtn.setAttribute('aria-label', prevLabel);
            }, 2000);
        } catch {
            copyBtn.title = 'Copy failed';
            copyBtn.setAttribute('aria-label', 'Copy failed');
            window.setTimeout(() => {
                copyBtn.title = prevTitle;
                copyBtn.setAttribute('aria-label', prevLabel);
            }, 2000);
        }
    }

    copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void copyCodeBlockSource();
    });

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

    renderReadonly(node);

    /**
     * Clicks on pre/code (and padded body) do not resolve to a doc position for `NodeSelection`
     * the way TOC does; mirror {@link ./wiki-mermaid-code-block-widget.ts} / HTML block widgets.
     */
    function onMouseDown(e: MouseEvent) {
        if (e.button !== 0 || editing) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const target = e.target as Element | null;
        if (!target || !dom.contains(target)) return;
        if (target.closest?.('button, textarea, input, select')) return;

        const pos = getPos();
        if (pos === undefined) return;
        const pmNode = view.state.doc.nodeAt(pos);
        if (!pmNode || pmNode.type.name !== 'code_block') return;
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
            if (!editing) {
                renderReadonly(updated);
            }
            return true;
        },
        /**
         * When this returns true, ProseMirror skips input handling for the event (see `eventBelongsToView`).
         * We must return false for clicks on the widget shell so NodeSelection + `selectNode` work like TOC/TOSP.
         */
        stopEvent(event) {
            const t = event.target as Node | null;
            if (!t || !dom.contains(t)) return false;
            if (editing) {
                return true;
            }
            if ((t as Element).closest?.('button')) {
                return true;
            }
            return false;
        },
        ignoreMutation: () => true,
        destroy() {
            dom.removeEventListener('mousedown', onMouseDown);
        },
    };
}

/**
 * Renders `code_block` as a read-only widget (like TOC/TOSP); edit via header actions.
 */
export function wikiCodeBlockWidgetPlugin(): Plugin {
    return new Plugin({
        props: {
            nodeViews: {
                code_block: (node, view, getPos) =>
                    isMermaidFenceParams(node.attrs['params'])
                        ? createMermaidCodeBlockNodeView(node, view, getPos)
                        : createCodeBlockNodeView(node, view, getPos),
            },
        },
    });
}

/**
 * Blocks typing, paste, and drop into the document while the selection is inside a `code_block`
 * (content is edited only via the code-block widget).
 */
export function wikiCodeBlockInputGuardPlugin(): Plugin {
    return new Plugin({
        props: {
            handleTextInput(view, from) {
                if (selectionInsideCodeBlock(view.state, from)) return true;
                return false;
            },
            handlePaste(view) {
                if (selectionInsideCodeBlock(view.state)) return true;
                return false;
            },
            handleDrop(view) {
                if (selectionInsideCodeBlock(view.state)) return true;
                return false;
            },
        },
    });
}
