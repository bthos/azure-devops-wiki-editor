import type { Node as PMNode } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';

import { selectionInsideCodeBlock, wikiCodeBlockEditMetaKey } from './wiki-code-block-context';

let codeBlockLangDatalistSeq = 0;

/** Strip characters that would break fenced markdown; cap length (fence info string). */
function sanitizeCodeFenceParams(raw: string): string {
    return raw
        .trim()
        .replace(/[\n\r\t`]/g, '')
        .slice(0, 64);
}

/** Same pencil glyph as {@link ./wiki-ado-widget-plugin.ts} HTML widget + TOC-style `fill` icons. */
const editSvg = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
</svg>`;

const saveSvg = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06l2.97 2.97 6.72-6.72a.75.75 0 011.06 0z"/>
</svg>`;

const cancelSvg = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
</svg>`;

const deleteSvg = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
  <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
</svg>`;

function createCodeBlockNodeView(node: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
    let editing = false;
    let textarea: HTMLTextAreaElement | null = null;
    let langInput: HTMLInputElement | null = null;

    const dom = document.createElement('div');
    dom.className = 'ado-code-widget';
    dom.contentEditable = 'false';
    dom.setAttribute('role', 'region');
    dom.setAttribute('aria-label', 'Code block');

    const header = document.createElement('div');
    header.className = 'ado-widget-header';

    const title = document.createElement('span');
    title.className = 'ado-code-title';

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ado-widget-buttons';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ado-widget-edit';
    editBtn.title = 'Edit code';
    editBtn.setAttribute('aria-label', 'Edit code');
    editBtn.innerHTML = editSvg;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'ado-widget-edit';
    saveBtn.title = 'Save code';
    saveBtn.setAttribute('aria-label', 'Save code');
    saveBtn.innerHTML = saveSvg;
    saveBtn.style.display = 'none';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ado-widget-edit';
    cancelBtn.title = 'Cancel editing';
    cancelBtn.setAttribute('aria-label', 'Cancel editing');
    cancelBtn.innerHTML = cancelSvg;
    cancelBtn.style.display = 'none';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'ado-widget-delete';
    deleteBtn.title = 'Remove code block';
    deleteBtn.setAttribute('aria-label', 'Remove code block');
    deleteBtn.innerHTML = deleteSvg;

    buttonGroup.append(editBtn, saveBtn, cancelBtn, deleteBtn);
    header.append(title, buttonGroup);
    dom.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ado-code-body';

    const pre = document.createElement('pre');
    const codeEl = document.createElement('code');
    pre.appendChild(codeEl);
    body.appendChild(pre);
    dom.appendChild(body);

    function setTitle(n: PMNode) {
        const params = String(n.attrs['params'] ?? '').trim();
        title.textContent = params ? `Code: ${params}` : 'Code';
    }

    function renderReadonly(n: PMNode) {
        setTitle(n);
        codeEl.textContent = n.textContent;
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
        langLabel.setAttribute('for', `ado-code-lang-${codeBlockLangDatalistSeq}`);
        langLabel.textContent = 'Language';

        langInput = document.createElement('input');
        langInput.id = `ado-code-lang-${codeBlockLangDatalistSeq}`;
        codeBlockLangDatalistSeq += 1;
        langInput.className = 'ado-code-lang-input';
        langInput.type = 'text';
        langInput.setAttribute('spellcheck', 'false');
        langInput.setAttribute('aria-label', 'Code block language');
        langInput.setAttribute('placeholder', 'e.g. typescript, bash, json');
        langInput.value = String(n.attrs['params'] ?? '').trim();
        langInput.setAttribute('list', `${langInput.id}-list`);

        const datalist = document.createElement('datalist');
        datalist.id = `${langInput.id}-list`;
        for (const opt of [
            'text',
            'bash',
            'sh',
            'powershell',
            'json',
            'yaml',
            'xml',
            'html',
            'css',
            'javascript',
            'typescript',
            'tsx',
            'jsx',
            'markdown',
            'python',
            'csharp',
            'sql',
            'dockerfile',
            'ini',
            'toml',
        ]) {
            const o = document.createElement('option');
            o.value = opt;
            datalist.appendChild(o);
        }

        langRow.append(langLabel, langInput, datalist);
        langInput.addEventListener('input', syncTitleFromLangInput);

        textarea = document.createElement('textarea');
        textarea.className = 'ado-code-textarea';
        textarea.value = n.textContent;
        textarea.setAttribute('spellcheck', 'false');
        textarea.setAttribute('aria-label', 'Code editor');
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
        destroy() {},
    };
}

/**
 * Renders `code_block` as a read-only widget (like TOC/TOSP); edit via header actions.
 */
export function wikiCodeBlockWidgetPlugin(): Plugin {
    return new Plugin({
        props: {
            nodeViews: {
                code_block: (node, view, getPos) => createCodeBlockNodeView(node, view, getPos),
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
