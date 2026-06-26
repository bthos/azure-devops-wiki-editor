import type { EditorState } from 'prosemirror-state';
import { NodeSelection } from 'prosemirror-state';

/** Set on transactions dispatched from the code-block widget editor (save). */
export const wikiCodeBlockEditMetaKey = 'wikiCodeBlockEdit';

/**
 * True when the position or selection sits in a `code_block` (including a `NodeSelection` on it).
 * Used to lock the main editor and toolbar.
 */
export function selectionInsideCodeBlock(state: EditorState, pos?: number): boolean {
    const $pos = pos !== undefined ? state.doc.resolve(pos) : state.selection.$from;
    for (let d = $pos.depth; d > 0; d--) {
        if ($pos.node(d).type.name === 'code_block') return true;
    }
    const { selection } = state;
    if (selection instanceof NodeSelection && selection.node.type.name === 'code_block') return true;
    return false;
}
