import type { Node, NodeType } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';

/** Innermost `bullet_list` / `ordered_list` ancestor of the selection (same scan order as {@link listActive}). */
function innermostListContainer(state: EditorState): Node | null {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
        const n = $from.node(d);
        if (n.type.name === 'bullet_list' || n.type.name === 'ordered_list') {
            return n;
        }
    }
    return null;
}

/**
 * If the cursor is already in a bullet list, lift the current block(s) out of it;
 * otherwise wrap in a bullet list (same as {@link wrapInList}).
 */
export function createToggleBulletList(bulletListType: NodeType, listItemType: NodeType): Command {
    const lift = liftListItem(listItemType);
    const wrap = wrapInList(bulletListType);
    return (state, dispatch) => {
        const inner = innermostListContainer(state);
        if (inner && inner.type === bulletListType) {
            return lift(state, dispatch);
        }
        return wrap(state, dispatch);
    };
}

/**
 * If the cursor is already in an ordered list, lift out; otherwise wrap in an ordered list.
 */
export function createToggleOrderedList(orderedListType: NodeType, listItemType: NodeType): Command {
    const lift = liftListItem(listItemType);
    const wrap = wrapInList(orderedListType);
    return (state, dispatch) => {
        const inner = innermostListContainer(state);
        if (inner && inner.type === orderedListType) {
            return lift(state, dispatch);
        }
        return wrap(state, dispatch);
    };
}
