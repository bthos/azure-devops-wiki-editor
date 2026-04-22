import type { Node, Schema } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import { isInTable, tableNodeTypes } from 'prosemirror-tables';

/**
 * Build a rectangular table (GFM-style: optional header row + body rows).
 * Each cell contains one empty paragraph.
 */
export function insertSimpleTable(schema: Schema, bodyRows: number, cols: number, withHeaderRow: boolean): Node {
    const types = tableNodeTypes(schema);
    const emptyP = () => schema.nodes.paragraph.create();

    const rowNodes: Node[] = [];

    if (withHeaderRow) {
        const headers: Node[] = [];
        for (let c = 0; c < cols; c++) {
            headers.push(types.header_cell.create(null, [emptyP()]));
        }
        rowNodes.push(types.row.create(null, headers));
    }

    for (let r = 0; r < bodyRows; r++) {
        const cells: Node[] = [];
        for (let c = 0; c < cols; c++) {
            cells.push(types.cell.create(null, [emptyP()]));
        }
        rowNodes.push(types.row.create(null, cells));
    }

    return types.table.create(null, rowNodes);
}

/**
 * Insert a GFM-style table (header row + body). Skips when the selection is already inside a table.
 */
export function insertWikiTable(
    bodyRows: number,
    cols: number,
    withHeaderRow: boolean,
): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
    return (state, dispatch) => {
        if (isInTable(state)) return false;
        const { schema } = state;
        if (!schema.nodes.table) return false;
        const table = insertSimpleTable(schema, bodyRows, cols, withHeaderRow);
        const { $from } = state.selection;
        const depth = $from.depth;
        const parent = $from.parent;

        if (parent.type === schema.nodes.paragraph && parent.content.size === 0) {
            const start = $from.before(depth);
            const end = $from.after(depth);
            const outer = $from.node(depth - 1);
            const outerIndex = $from.index(depth - 1);
            if (!outer.canReplaceWith(outerIndex, outerIndex + 1, table.type)) {
                return false;
            }
            if (dispatch) dispatch(state.tr.replaceWith(start, end, table).scrollIntoView());
            return true;
        }

        const after = $from.after(depth);
        const $after = state.doc.resolve(after);
        const container = $after.parent;
        const index = $after.index();
        if (!container.canReplaceWith(index, index, table.type)) {
            return false;
        }
        if (dispatch) dispatch(state.tr.insert(after, table).scrollIntoView());
        return true;
    };
}
