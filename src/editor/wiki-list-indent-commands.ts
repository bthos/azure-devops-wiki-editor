import { Fragment, type NodeType } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import { liftListItem, sinkListItem } from 'prosemirror-schema-list';

type ListItemContext = {
    list: import('prosemirror-model').Node;
    item: import('prosemirror-model').Node;
    itemStart: number;
    itemEnd: number;
    index: number;
};

/**
 * Find the innermost enclosing `list_item` whose parent is `bullet_list` or `ordered_list`.
 */
function enclosingListItem(state: EditorState, itemType: NodeType): ListItemContext | null {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type !== itemType) continue;
        const listDepth = d - 1;
        if (listDepth < 1) return null;
        const list = $from.node(listDepth);
        if (list.type.name !== 'bullet_list' && list.type.name !== 'ordered_list') continue;
        const index = $from.index(listDepth);
        const itemStart = $from.before(d);
        const itemEnd = $from.after(d);
        return { list, item: node, itemStart, itemEnd, index };
    }
    return null;
}

/**
 * `sinkListItem` only nests under a *previous* sibling, so the first item never indents.
 * When the cursor is in the first `list_item`, wrap its block content in an inner list of the same type
 * (valid Markdown nesting, reversible with {@link liftListItem}).
 */
function indentFirstListItem(state: EditorState, dispatch: ((tr: import('prosemirror-state').Transaction) => void) | undefined): boolean {
    const itemType = state.schema.nodes.list_item;
    if (!itemType) return false;
    const ctx = enclosingListItem(state, itemType);
    if (!ctx || ctx.index !== 0) return false;

    const { list, item, itemStart, itemEnd } = ctx;
    const innerList = list.type.create(list.attrs, itemType.create(item.attrs, item.content));
    const wrapped = itemType.create(item.attrs, innerList);
    const $ = state.doc.resolve(itemStart);
    const idx = $.index($.depth);
    if (!$.parent.canReplace(idx, idx + 1, Fragment.from(wrapped))) return false;
    if (!dispatch) return true;
    dispatch(state.tr.replaceWith(itemStart, itemEnd, wrapped).scrollIntoView());
    return true;
}

/**
 * Increase list indent: standard {@link sinkListItem}, or wrap the first item in an inner list.
 */
export function wikiIndentListItem(itemType: NodeType): Command {
    const sink = sinkListItem(itemType);
    return (state, dispatch) => {
        if (sink(state, dispatch)) return true;
        return indentFirstListItem(state, dispatch);
    };
}
