import { redo, undo } from 'prosemirror-history';

import type { MarkType, Schema } from 'prosemirror-model';

import type { EditorState, Transaction } from 'prosemirror-state';

import type { EditorView } from 'prosemirror-view';

import { setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';

import { createToggleBulletList, createToggleOrderedList } from './wiki-list-toggle-commands';

import {

    addColumnAfter,

    addColumnBefore,

    addRowAfter,

    addRowBefore,

    deleteColumn,

    deleteRow,

    deleteTable,

    isInTable,

} from 'prosemirror-tables';

import { liftListItem } from 'prosemirror-schema-list';

import { wikiIndentListItem } from './wiki-list-indent-commands';

import type { AdoAttachmentService } from '../services/attachment-service';

import type { AdoMentionService } from '../services/mention-service';

import { WIKI_EDITOR_TOOLBAR_CLASS } from './wiki-editor-dom';

import { insertUploadedFilesIntoWikiEditor } from './wiki-attachment-upload';

import { insertWikiTable } from './wiki-table-commands';

import {
    applyWikiStyle,
    insertAdoHtmlBlock,
    insertAdoTocBlock,
    insertAdoTospBlock,
    insertWikiMentionDisplayName,
    insertWikiMentionFromPrompt,
} from './wiki-insert-markers';

import { openWikiMentionPickerDialog } from './wiki-mention-picker-dialog';

import { openWikiPasteHtmlDialog } from './wiki-paste-html-dialog';

import { createToggleWikiTaskList } from './wiki-task-list-commands';

import { selectionInsideCodeBlock } from './wiki-code-block-context';

import { wikiPmToolbarAttachmentButtonHtml, wikiPmToolbarInnerHtml } from './wiki-pm-toolbar-html';



/** Reuse Milkdown toolbar look (loaded with this module). */

import '../toolbar/toolbar.css';



export type WikiToolbarMountOptions = {

    attachmentService?: AdoAttachmentService | null;

    /** When set, @mention opens team member picker (Core REST); otherwise a plain prompt. */

    mentionService?: AdoMentionService | null;

};



function run(view: EditorView, f: (state: EditorState, dispatch: (tr: Transaction) => void) => boolean): void {

    f(view.state, view.dispatch.bind(view));

    view.focus();

}



function markActive(state: EditorState, type: MarkType): boolean {

    const { empty, $from, from, to } = state.selection;

    if (empty) {

        return !!type.isInSet(state.storedMarks || $from.marks());

    }

    return state.doc.rangeHasMark(from, to, type);

}



function wikiStyleAttrsAt(state: EditorState, pos: number): { color: string; backgroundColor: string } {

    const mt = state.schema.marks['wikiStyle'];

    if (!mt) return { color: '', backgroundColor: '' };

    const $ = state.doc.resolve(pos);

    const m = $.marks().find((x) => x.type === mt);

    return {

        color: String(m?.attrs['color'] ?? ''),

        backgroundColor: String(m?.attrs['backgroundColor'] ?? ''),

    };

}



function syncWikiStylePickers(toolbar: HTMLElement, state: EditorState): void {

    const fg = toolbar.querySelector<HTMLInputElement>('input[data-toolbar="wiki-style-fg"]');

    const bg = toolbar.querySelector<HTMLInputElement>('input[data-toolbar="wiki-style-bg"]');

    if (!fg || !bg) return;

    const { color, backgroundColor } = wikiStyleAttrsAt(state, state.selection.from);

    fg.value = color || '#000000';

    bg.value = backgroundColor || '#ffff00';

}



function headingActive(state: EditorState, level: number): boolean {

    const $from = state.selection.$from;

    for (let d = $from.depth; d > 0; d--) {

        const node = $from.node(d);

        if (node.type.name === 'heading' && node.attrs['level'] === level) {

            return true;

        }

    }

    return false;

}



function listActive(state: EditorState, listName: 'bullet_list' | 'ordered_list'): boolean {

    const $from = state.selection.$from;

    for (let d = $from.depth; d > 0; d--) {

        if ($from.node(d).type.name === listName) {

            return true;

        }

    }

    return false;

}



/** True when the innermost enclosing bullet/ordered list has at least one task `list_item`. */

function taskListActive(state: EditorState): boolean {

    const $from = state.selection.$from;

    for (let d = $from.depth; d > 0; d--) {

        const n = $from.node(d);

        if (n.type.name !== 'bullet_list' && n.type.name !== 'ordered_list') continue;

        for (let i = 0; i < n.childCount; i++) {

            if (typeof n.child(i).attrs['checked'] === 'boolean') return true;

        }

        return false;

    }

    return false;

}



function blockquoteActive(state: EditorState): boolean {

    const $from = state.selection.$from;

    for (let d = $from.depth; d > 0; d--) {

        if ($from.node(d).type.name === 'blockquote') {

            return true;

        }

    }

    return false;

}



function insertHorizontalRule(schema: Schema) {

    return (state: EditorState, dispatch: (tr: Transaction) => void) => {

        const hr = schema.nodes.horizontal_rule;

        if (!hr) return false;

        const tr = state.tr.replaceSelectionWith(hr.create()).scrollIntoView();

        if (!tr.docChanged) return false;

        dispatch(tr);

        return true;

    };

}



function closeWikiPmDropdowns(toolbar: HTMLElement): void {

    toolbar.querySelectorAll('.toolbar-dropdown-menu.show').forEach((m) => m.classList.remove('show'));

}



function attachWikiPmTableGrid(toolbar: HTMLElement, view: EditorView): void {

    const grid = toolbar.querySelector('.table-grid') as HTMLElement | null;

    if (!grid) return;



    const rows = parseInt(grid.dataset.rows || '6', 10);

    const cols = parseInt(grid.dataset.cols || '6', 10);

    const sizeLabel = toolbar.querySelector('.table-grid-size') as HTMLElement | null;



    for (let r = 0; r < rows; r++) {

        for (let c = 0; c < cols; c++) {

            const cell = document.createElement('div');

            cell.className = 'table-grid-cell';

            cell.dataset.row = String(r + 1);

            cell.dataset.col = String(c + 1);

            grid.appendChild(cell);

        }

    }



    grid.addEventListener('mouseover', (e) => {

        const target = e.target as HTMLElement;

        if (!target.classList.contains('table-grid-cell')) return;



        const hoverRow = parseInt(target.dataset.row || '1', 10);

        const hoverCol = parseInt(target.dataset.col || '1', 10);



        if (sizeLabel) {

            sizeLabel.textContent = `${hoverCol} × ${hoverRow}`;

        }



        grid.querySelectorAll('.table-grid-cell').forEach((cell) => {

            const cellEl = cell as HTMLElement;

            const cellRow = parseInt(cellEl.dataset.row || '0', 10);

            const cellCol = parseInt(cellEl.dataset.col || '0', 10);



            if (cellRow <= hoverRow && cellCol <= hoverCol) {

                cellEl.classList.add('highlighted');

            } else {

                cellEl.classList.remove('highlighted');

            }

        });

    });



    grid.addEventListener('mouseleave', () => {

        if (sizeLabel) {

            sizeLabel.textContent = '1 × 1';

        }

        grid.querySelectorAll('.table-grid-cell').forEach((cell) => {

            (cell as HTMLElement).classList.remove('highlighted');

        });

    });



    grid.addEventListener('click', (e) => {

        const target = e.target as HTMLElement;

        if (!target.classList.contains('table-grid-cell')) return;



        const selectedRows = parseInt(target.dataset.row || '1', 10);

        const selectedCols = parseInt(target.dataset.col || '1', 10);



        closeWikiPmDropdowns(toolbar);



        if (isInTable(view.state)) {

            view.focus();

            return;

        }



        run(view, insertWikiTable(selectedRows, selectedCols, true));

    });

}



function refreshToolbar(toolbar: HTMLElement, state: EditorState): void {

    const schema = state.schema;

    const inTable = isInTable(state);

    const inCodeBlock = selectionInsideCodeBlock(state);

    let inHeading = false;

    const $h = state.selection.$from;

    for (let d = $h.depth; d > 0; d--) {

        if ($h.node(d).type.name === 'heading') {

            inHeading = true;

            break;

        }

    }

    const inList = listActive(state, 'bullet_list') || listActive(state, 'ordered_list');

    const pasteHtmlDisabled = inTable || inCodeBlock || inHeading || inList;

    const listButtonsDisabled = inTable || inCodeBlock || inHeading;

    const listItemType = schema.nodes.list_item;
    const canIndentList =
        !listButtonsDisabled && listItemType ? wikiIndentListItem(listItemType)(state) : false;
    const canOutdentList =
        !listButtonsDisabled && listItemType ? liftListItem(listItemType)(state) : false;

    const quoteLikeDisabled = inTable || inCodeBlock || inHeading || inList;



    for (const btn of Array.from(toolbar.querySelectorAll<HTMLButtonElement>('.toolbar-button'))) {

        const mark = btn.dataset['mark'];

        const action = btn.dataset['action'];

        btn.classList.remove('active');

        if (mark === 'strong' && schema.marks.strong && markActive(state, schema.marks.strong)) {

            btn.classList.add('active');

        } else if (mark === 'em' && schema.marks.em && markActive(state, schema.marks.em)) {

            btn.classList.add('active');

        } else if (mark === 'code' && schema.marks.code && markActive(state, schema.marks.code)) {

            btn.classList.add('active');

        } else if (

            mark === 'strikethrough' &&

            schema.marks.strikethrough &&

            markActive(state, schema.marks.strikethrough)

        ) {

            btn.classList.add('active');

        } else if (mark === 'link' && schema.marks.link && markActive(state, schema.marks.link)) {

            btn.classList.add('active');

        } else if (action === 'wiki-style-menu' && schema.marks.wikiStyle && markActive(state, schema.marks.wikiStyle)) {

            btn.classList.add('active');

        } else if (action === 'heading1' && headingActive(state, 1)) {

            btn.classList.add('active');

        } else if (action === 'heading2' && headingActive(state, 2)) {

            btn.classList.add('active');

        } else if (action === 'heading3' && headingActive(state, 3)) {

            btn.classList.add('active');

        } else if (action === 'bullet-list' && listActive(state, 'bullet_list') && !taskListActive(state)) {

            btn.classList.add('active');

        } else if (action === 'ordered-list' && listActive(state, 'ordered_list') && !taskListActive(state)) {

            btn.classList.add('active');

        } else if (action === 'task-list' && taskListActive(state)) {

            btn.classList.add('active');

        } else if (action === 'quote' && blockquoteActive(state)) {

            btn.classList.add('active');

        } else if (action === 'code-block' && selectionInsideCodeBlock(state)) {

            btn.classList.add('active');

        }



        if (btn.dataset['requireTable'] === 'true') {

            btn.disabled = !inTable;

            btn.classList.toggle('disabled', !inTable);

        }

        if (btn.dataset['requireNotTable'] === 'true') {

            btn.disabled = inTable;

            btn.classList.toggle('disabled', inTable);

        }

        if (action === 'bullet-list' || action === 'ordered-list' || action === 'task-list') {

            btn.disabled = listButtonsDisabled;

            btn.classList.toggle('disabled', listButtonsDisabled);

        }

        if (action === 'indent-list') {

            btn.disabled = !canIndentList;

            btn.classList.toggle('disabled', !canIndentList);

        }

        if (action === 'outdent-list') {

            btn.disabled = !canOutdentList;

            btn.classList.toggle('disabled', !canOutdentList);

        }

        if (action === 'insert-toc' || action === 'insert-tosp') {

            btn.disabled = listButtonsDisabled;

            btn.classList.toggle('disabled', listButtonsDisabled);

        }

        if (action === 'paste-html') {

            btn.disabled = pasteHtmlDisabled;

            btn.classList.toggle('disabled', pasteHtmlDisabled);

        }

        if (action === 'insert-mention') {

            btn.disabled = inCodeBlock;

            btn.classList.toggle('disabled', inCodeBlock);

        }

        if (action === 'quote' || action === 'code-block' || action === 'hr') {

            btn.disabled = quoteLikeDisabled;

            btn.classList.toggle('disabled', quoteLikeDisabled);

        }

    }

    if (selectionInsideCodeBlock(state)) {

        for (const btn of Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button[data-action]'))) {

            const act = btn.getAttribute('data-action');

            if (act !== 'undo' && act !== 'redo') {

                btn.disabled = true;

                btn.classList.add('disabled');

            }

        }

        toolbar.querySelectorAll<HTMLInputElement>('input[data-toolbar^="wiki-style"]').forEach((el) => {

            el.disabled = true;

        });

    } else {

        toolbar.querySelectorAll<HTMLInputElement>('input[data-toolbar^="wiki-style"]').forEach((el) => {

            el.disabled = false;

        });

    }

    syncWikiStylePickers(toolbar, state);

}



/**

 * Formatting toolbar for the ProseMirror wiki path. Markup matches Milkdown {@link ../toolbar/view.ts};

 * inserts before `.editor` inside the `.wiki-editor-shell` wrapper.

 */

export function mountWikiToolbar(host: HTMLElement, view: EditorView, opts?: WikiToolbarMountOptions): () => void {

    const schema = view.state.schema;

    const attachmentService = opts?.attachmentService ?? null;

    const mentionService = opts?.mentionService ?? null;

    const attachmentHtml = attachmentService != null ? wikiPmToolbarAttachmentButtonHtml : '';



    const toolbar = document.createElement('div');

    toolbar.className = `${WIKI_EDITOR_TOOLBAR_CLASS} wiki-pm-toolbar`;

    toolbar.setAttribute('role', 'toolbar');

    toolbar.innerHTML = wikiPmToolbarInnerHtml({ attachmentButtonHtml: attachmentHtml });



    host.insertBefore(toolbar, host.firstChild);

    const fgInput = toolbar.querySelector<HTMLInputElement>('input[data-toolbar="wiki-style-fg"]');

    const bgInput = toolbar.querySelector<HTMLInputElement>('input[data-toolbar="wiki-style-bg"]');

    const applyFgFromPicker = () => {

        if (!fgInput || selectionInsideCodeBlock(view.state)) return;

        if (applyWikiStyle({ color: fgInput.value })(view.state, view.dispatch.bind(view))) view.focus();

    };

    const applyBgFromPicker = () => {

        if (!bgInput || selectionInsideCodeBlock(view.state)) return;

        if (applyWikiStyle({ backgroundColor: bgInput.value })(view.state, view.dispatch.bind(view))) view.focus();

    };

    fgInput?.addEventListener('change', applyFgFromPicker);

    bgInput?.addEventListener('change', applyBgFromPicker);



    attachWikiPmTableGrid(toolbar, view);



    const onDocClickCloseMenus = (e: MouseEvent) => {

        if (!toolbar.contains(e.target as Node)) {

            closeWikiPmDropdowns(toolbar);

        }

    };

    document.addEventListener('click', onDocClickCloseMenus);



    let raf = 0;

    const onRefresh = () => {

        cancelAnimationFrame(raf);

        raf = requestAnimationFrame(() => refreshToolbar(toolbar, view.state));

    };

    view.dom.addEventListener('keyup', onRefresh);

    view.dom.addEventListener('mouseup', onRefresh);

    document.addEventListener('selectionchange', onRefresh);



    toolbar.addEventListener('click', (ev) => {

        const t = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;

        if (!t || !toolbar.contains(t)) return;



        const action = t.getAttribute('data-action');

        if (!action) return;

        if (selectionInsideCodeBlock(view.state) && action !== 'undo' && action !== 'redo') {

            ev.preventDefault();

            return;

        }



        if (action === 'table-menu' || action === 'table-insert-menu' || action === 'wiki-style-menu') {

            ev.preventDefault();

            ev.stopPropagation();

            const dropdown = t.closest('.toolbar-dropdown');

            const menu = dropdown?.querySelector('.toolbar-dropdown-menu');

            if (menu) {

                const isOpen = menu.classList.contains('show');

                closeWikiPmDropdowns(toolbar);

                if (!isOpen) {

                    menu.classList.add('show');

                }

            }

            return;

        }



        closeWikiPmDropdowns(toolbar);



        ev.preventDefault();

        switch (action) {

            case 'undo':

                run(view, undo);

                break;

            case 'redo':

                run(view, redo);

                break;

            case 'bold':

                if (schema.marks.strong) run(view, toggleMark(schema.marks.strong));

                break;

            case 'italic':

                if (schema.marks.em) run(view, toggleMark(schema.marks.em));

                break;

            case 'strikethrough':

                if (schema.marks.strikethrough) run(view, toggleMark(schema.marks.strikethrough));

                break;

            case 'code':

                if (schema.marks.code) run(view, toggleMark(schema.marks.code));

                break;

            case 'link': {

                if (!schema.marks.link) break;

                const href = window.prompt('Link URL', 'https://');

                if (href === null) break;

                const trimmed = href.trim();

                if (trimmed === '') {

                    run(view, toggleMark(schema.marks.link));

                } else {

                    run(view, toggleMark(schema.marks.link, { href: trimmed, title: null }));

                }

                break;

            }

            case 'heading1':

                run(view, setBlockType(schema.nodes.heading, { level: 1 }));

                break;

            case 'heading2':

                run(view, setBlockType(schema.nodes.heading, { level: 2 }));

                break;

            case 'heading3':

                run(view, setBlockType(schema.nodes.heading, { level: 3 }));

                break;

            case 'bullet-list':

                if (schema.nodes.bullet_list && schema.nodes.list_item) {

                    run(view, createToggleBulletList(schema.nodes.bullet_list, schema.nodes.list_item));

                }

                break;

            case 'ordered-list':

                if (schema.nodes.ordered_list && schema.nodes.list_item) {

                    run(view, createToggleOrderedList(schema.nodes.ordered_list, schema.nodes.list_item));

                }

                break;

            case 'task-list':

                run(view, createToggleWikiTaskList(schema.nodes.bullet_list));

                break;

            case 'indent-list':

                if (schema.nodes.list_item) {

                    run(view, wikiIndentListItem(schema.nodes.list_item));

                }

                break;

            case 'outdent-list':

                if (schema.nodes.list_item) {

                    run(view, liftListItem(schema.nodes.list_item));

                }

                break;

            case 'insert-toc':

                run(view, insertAdoTocBlock());

                break;

            case 'insert-tosp':

                run(view, insertAdoTospBlock());

                break;

            case 'insert-mention':

                if (mentionService) {

                    void openWikiMentionPickerDialog({ mentionService, title: 'Mention someone' }).then((identity) => {

                        if (!identity) return;

                        const label = mentionService.prepareMentionFromTeamMember(identity);

                        if (!label) return;

                        run(view, insertWikiMentionDisplayName(label));

                    });

                } else {

                    run(view, insertWikiMentionFromPrompt());

                }

                break;

            case 'paste-html':

                void openWikiPasteHtmlDialog({ title: 'Paste as HTML' }).then((raw) => {
                    if (raw === null) return;
                    const ok = insertAdoHtmlBlock(raw)(view.state, view.dispatch.bind(view));
                    if (ok) view.focus();
                });

                break;

            case 'wiki-style-clear-fg':

                run(view, applyWikiStyle({ color: null }));

                break;

            case 'wiki-style-clear-bg':

                run(view, applyWikiStyle({ backgroundColor: null }));

                break;

            case 'wiki-style-clear-all':

                run(view, applyWikiStyle({ color: null, backgroundColor: null }));

                break;

            case 'quote':

                run(view, wrapIn(schema.nodes.blockquote));

                break;

            case 'code-block':

                run(view, setBlockType(schema.nodes.code_block, { params: '' }));

                break;

            case 'hr':

                run(view, insertHorizontalRule(schema));

                break;

            case 'add-row-before':

                run(view, addRowBefore);

                break;

            case 'add-row-after':

                run(view, addRowAfter);

                break;

            case 'delete-row':

                run(view, deleteRow);

                break;

            case 'add-col-before':

                run(view, addColumnBefore);

                break;

            case 'add-col-after':

                run(view, addColumnAfter);

                break;

            case 'delete-col':

                run(view, deleteColumn);

                break;

            case 'delete-table':

                run(view, deleteTable);

                break;

            case 'image': {

                if (!attachmentService) break;

                const input = document.createElement('input');

                input.type = 'file';

                input.multiple = true;

                input.style.display = 'none';

                input.onchange = () => {

                    const list = input.files;

                    if (list?.length) {

                        void insertUploadedFilesIntoWikiEditor(view, attachmentService, Array.from(list));

                    }

                    input.remove();

                };

                document.body.appendChild(input);

                input.click();

                break;

            }

            default:

                break;

        }

        onRefresh();

    });



    onRefresh();



    return () => {

        cancelAnimationFrame(raf);

        fgInput?.removeEventListener('change', applyFgFromPicker);

        bgInput?.removeEventListener('change', applyBgFromPicker);

        document.removeEventListener('click', onDocClickCloseMenus);

        view.dom.removeEventListener('keyup', onRefresh);

        view.dom.removeEventListener('mouseup', onRefresh);

        document.removeEventListener('selectionchange', onRefresh);

        toolbar.remove();

    };

}


