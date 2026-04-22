import { Fragment, type Node, type NodeType } from 'prosemirror-model';
import { wrapInList } from 'prosemirror-schema-list';
import type { Command, EditorState, Transaction } from 'prosemirror-state';

function isListType(state: EditorState, n: Node): boolean {
    return n.type === state.schema.nodes.bullet_list || n.type === state.schema.nodes.ordered_list;
}

/**
 * When the selection sits inside a bullet or ordered list, toggle between plain items (`checked: null`)
 * and GFM task items (`checked: boolean`). If the list is already all tasks, clear task state.
 */
export function toggleTaskAttrsInEnclosingList(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
    const $from = state.selection.$from;
    let listDepth = -1;
    for (let d = $from.depth; d > 0; d--) {
        if (isListType(state, $from.node(d))) {
            listDepth = d;
            break;
        }
    }
    if (listDepth < 0) return false;

    const list = $from.node(listDepth);
    let allTask = list.childCount > 0;
    for (let i = 0; i < list.childCount; i++) {
        if (typeof list.child(i).attrs['checked'] !== 'boolean') allTask = false;
    }
    const makePlain = allTask;

    if (makePlain) {
        const listFrom = $from.before(listDepth);
        const listTo = $from.after(listDepth);
        let lifted = Fragment.empty;
        list.forEach((child) => {
            lifted = lifted.append(child.content);
        });
        const $listFrom = state.doc.resolve(listFrom);
        const parentDepth = listDepth - 1;
        const parent = $listFrom.node(parentDepth);
        const indexInParent = $listFrom.index(parentDepth);
        if (!parent.canReplace(indexInParent, indexInParent + 1, lifted)) return false;
        if (!dispatch) return true;
        dispatch(state.tr.replaceWith(listFrom, listTo, lifted).scrollIntoView());
        return true;
    }

    if (!dispatch) return true;

    let tr = state.tr;
    let pos = $from.before(listDepth) + 1;
    list.forEach((child) => {
        const nextChecked =
            typeof child.attrs['checked'] === 'boolean' ? child.attrs['checked'] : false;
        tr = tr.setNodeMarkup(pos, undefined, { ...child.attrs, checked: nextChecked });
        pos += child.nodeSize;
    });
    dispatch(tr);
    return true;
}

/**
 * After {@link wrapInList} into a bullet list, mark every direct `list_item` as a task (`checked: false`).
 */
export function taskifyEnclosingList(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
        const n = $from.node(d);
        if (!isListType(state, n)) continue;

        if (!dispatch) return true;

        let tr = state.tr;
        let pos = $from.before(d) + 1;
        let changed = false;
        n.forEach((child) => {
            if (typeof child.attrs['checked'] !== 'boolean') {
                tr = tr.setNodeMarkup(pos, undefined, { ...child.attrs, checked: false });
                changed = true;
            }
            pos += child.nodeSize;
        });
        if (!changed) return false;
        dispatch(tr);
        return true;
    }
    return false;
}

/**
 * Toggle task list / wrap in a task bullet list.
 *
 * Note: `chainCommands(wrap, taskify)` is wrong here — `chainCommands` stops after the first
 * command that returns true and passes the same initial `state` to each, so `taskifyEnclosingList`
 * never ran after `wrapInList`. We apply wrap, derive post-wrap state, then taskify.
 */
export function createToggleWikiTaskList(bulletListType: NodeType): Command {
    const wrap = wrapInList(bulletListType);
    return (state, dispatch) => {
        if (toggleTaskAttrsInEnclosingList(state, dispatch)) return true;
        if (!dispatch) {
            return wrap(state, undefined);
        }
        let afterWrap = state;
        const dispatchAfterWrap = (tr: Transaction) => {
            dispatch(tr);
            afterWrap = afterWrap.apply(tr);
        };
        if (!wrap(state, dispatchAfterWrap)) return false;
        taskifyEnclosingList(afterWrap, dispatch);
        return true;
    };
}
