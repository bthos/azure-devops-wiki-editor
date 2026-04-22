import type { Command, EditorState, Transaction } from 'prosemirror-state';
import { isInTable } from 'prosemirror-tables';

import { selectionInsideCodeBlock } from './wiki-code-block-context';
import { sanitizeWikiHtml } from './wiki-html-sanitize';
import { normalizeWikiToolbarHexColor } from './wiki-text-color';

export { isWikiToolbarHexColor } from './wiki-text-color';

/** True when the selection is inside a `heading` ancestor. */
export function cursorInHeading(state: EditorState): boolean {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'heading') {
            return true;
        }
    }
    return false;
}

/** True when the selection is inside a bullet or ordered list (Milkdown disables HTML block there). */
export function selectionInList(state: EditorState): boolean {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
        const n = $from.node(d).type.name;
        if (n === 'bullet_list' || n === 'ordered_list') {
            return true;
        }
    }
    return false;
}

function insertAdoAtomBlock(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, nodeName: 'ado_toc' | 'ado_tosp'): boolean {
    if (isInTable(state) || selectionInsideCodeBlock(state) || cursorInHeading(state)) {
        return false;
    }
    const type = state.schema.nodes[nodeName];
    if (!type) {
        return false;
    }
    const atom = type.create();
    const { $from } = state.selection;
    const depth = $from.depth;
    const parent = $from.parent;
    const { schema } = state;

    if (parent.type === schema.nodes.paragraph && parent.content.size === 0) {
        const start = $from.before(depth);
        const end = $from.after(depth);
        const outer = $from.node(depth - 1);
        const outerIndex = $from.index(depth - 1);
        if (!outer.canReplaceWith(outerIndex, outerIndex + 1, type)) {
            return false;
        }
        if (dispatch) {
            dispatch(state.tr.replaceWith(start, end, atom).scrollIntoView());
        }
        return true;
    }

    const after = $from.after(depth);
    const $after = state.doc.resolve(after);
    const container = $after.parent;
    const index = $after.index();
    if (!container.canReplaceWith(index, index, type)) {
        return false;
    }
    if (dispatch) {
        dispatch(state.tr.insert(after, atom).scrollIntoView());
    }
    return true;
}

/** Inserts `[[_TOC_]]` widget (`ado_toc`). */
export function insertAdoTocBlock(): Command {
    return (state, dispatch) => insertAdoAtomBlock(state, dispatch, 'ado_toc');
}

/** Inserts `[[_TOSP_]]` widget (`ado_tosp`). */
export function insertAdoTospBlock(): Command {
    return (state, dispatch) => insertAdoAtomBlock(state, dispatch, 'ado_tosp');
}

function insertAdoHtmlBlockAtSelection(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, html: string): boolean {
    if (isInTable(state) || selectionInsideCodeBlock(state) || cursorInHeading(state) || selectionInList(state)) {
        return false;
    }
    const type = state.schema.nodes['ado_html_block'];
    if (!type) {
        return false;
    }
    const safe = sanitizeWikiHtml(html);
    const atom = type.create({ html: safe });
    const { $from } = state.selection;
    const depth = $from.depth;
    const parent = $from.parent;
    const { schema } = state;

    if (parent.type === schema.nodes.paragraph && parent.content.size === 0) {
        const start = $from.before(depth);
        const end = $from.after(depth);
        const outer = $from.node(depth - 1);
        const outerIndex = $from.index(depth - 1);
        if (!outer.canReplaceWith(outerIndex, outerIndex + 1, type)) {
            return false;
        }
        if (dispatch) {
            dispatch(state.tr.replaceWith(start, end, atom).scrollIntoView());
        }
        return true;
    }

    const after = $from.after(depth);
    const $after = state.doc.resolve(after);
    const container = $after.parent;
    const index = $after.index();
    if (!container.canReplaceWith(index, index, type)) {
        return false;
    }
    if (dispatch) {
        dispatch(state.tr.insert(after, atom).scrollIntoView());
    }
    return true;
}

/** Inserts an `ado_html_block` (toolbar “Paste as HTML”). */
export function insertAdoHtmlBlock(html: string): Command {
    return (state, dispatch) => insertAdoHtmlBlockAtSelection(state, dispatch, html);
}

export type WikiStylePatch = {
    /** Set hex (after normalize) or `null` to clear text color. Omit to leave unchanged. */
    color?: string | null;
    /** Set hex or `null` to clear highlight. Omit to leave unchanged. */
    backgroundColor?: string | null;
};

function readWikiStyleAt(state: EditorState, pos: number) {
    const markType = state.schema.marks['wikiStyle'];
    if (!markType) {
        return { color: '', backgroundColor: '' };
    }
    const $ = state.doc.resolve(pos);
    const m = $.marks().find((x) => x.type === markType);
    return {
        color: String(m?.attrs['color'] ?? ''),
        backgroundColor: String(m?.attrs['backgroundColor'] ?? ''),
    };
}

/**
 * Applies the `wikiStyle` mark (foreground and/or background). Empty selection updates stored marks.
 * Serializes to raw wiki HTML `<span style="color:…;background-color:…">`.
 */
export function applyWikiStyle(patch: WikiStylePatch): Command {
    return (state, dispatch) => {
        if (selectionInsideCodeBlock(state)) {
            return false;
        }
        const markType = state.schema.marks['wikiStyle'];
        if (!markType) {
            return false;
        }
        const { from, to, empty } = state.selection;
        const base = readWikiStyleAt(state, from);
        let color = base.color;
        let backgroundColor = base.backgroundColor;
        if (patch.color !== undefined) {
            color = patch.color === null ? '' : normalizeWikiToolbarHexColor(patch.color) ?? '';
        }
        if (patch.backgroundColor !== undefined) {
            backgroundColor =
                patch.backgroundColor === null ? '' : normalizeWikiToolbarHexColor(patch.backgroundColor) ?? '';
        }

        if (!color && !backgroundColor) {
            if (!dispatch) {
                return true;
            }
            if (empty) {
                const $from = state.selection.$from;
                const cleared = markType.removeFromSet(state.storedMarks ?? $from.marks());
                dispatch(state.tr.setStoredMarks(cleared).scrollIntoView());
                return true;
            }
            dispatch(state.tr.removeMark(from, to, markType).scrollIntoView());
            return true;
        }

        const mark = markType.create({ color, backgroundColor });
        if (!dispatch) {
            return true;
        }
        if (empty) {
            const $from = state.selection.$from;
            const next = mark.addToSet(markType.removeFromSet(state.storedMarks ?? $from.marks()));
            dispatch(state.tr.setStoredMarks(next).scrollIntoView());
            return true;
        }
        const tr = state.tr.removeMark(from, to, markType).addMark(from, to, mark).scrollIntoView();
        dispatch(tr);
        return true;
    };
}

/**
 * Inserts an inline {@link userMention} with the given display label (must match what {@link ../services/mention-service.AdoMentionService.prepareMentionFromTeamMember} returned for team picks).
 * Skips in code blocks; allowed in tables and headings.
 */
export function insertWikiMentionDisplayName(displayName: string): Command {
    return (state, dispatch) => {
        if (selectionInsideCodeBlock(state)) {
            return false;
        }
        const markType = state.schema.marks.userMention;
        if (!markType) {
            return false;
        }
        const trimmed = displayName.trim();
        if (!trimmed) {
            return false;
        }
        if (!dispatch) {
            return true;
        }
        const text = state.schema.text(trimmed, [markType.create({ userName: trimmed })]);
        dispatch(state.tr.replaceSelectionWith(text, false).scrollIntoView());
        return true;
    };
}

/**
 * Prompts for a display name and inserts an inline {@link userMention} mark (ADO-style chip).
 * Skips in code blocks; allowed in tables and headings.
 */
export function insertWikiMentionFromPrompt(): Command {
    return (state, dispatch) => {
        if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
            return false;
        }
        const raw = window.prompt('Mention - display name', '');
        if (raw == null) {
            return false;
        }
        return insertWikiMentionDisplayName(raw)(state, dispatch);
    };
}
