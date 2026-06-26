import { Fragment, type Node as PMNode, type Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { tableNodeTypes } from 'prosemirror-tables';

/**
 * If the first table row contains `table_cell` nodes (e.g. after deleting the header row),
 * convert those cells to `table_header` so the table stays GFM-shaped and serialization works.
 */
function promoteFirstRowCellsToHeader(table: PMNode, schema: Schema): PMNode | null {
    if (table.childCount === 0) {
        return null;
    }
    const types = tableNodeTypes(schema);
    const headerType = types.header_cell;
    const cellType = types.cell;
    const rowType = types.row;
    if (!headerType || !cellType || !rowType) {
        return null;
    }

    const firstRow = table.child(0);
    const newCells: PMNode[] = [];
    let changed = false;
    firstRow.forEach((cell) => {
        if (cell.type === cellType) {
            changed = true;
            newCells.push(headerType.create(cell.attrs, cell.content, cell.marks));
        } else {
            newCells.push(cell);
        }
    });
    if (!changed) {
        return null;
    }

    const newFirstRow = rowType.create(firstRow.attrs, Fragment.fromArray(newCells));
    const rows: PMNode[] = [newFirstRow];
    for (let i = 1; i < table.childCount; i++) {
        rows.push(table.child(i));
    }
    return table.copy(Fragment.fromArray(rows));
}

/** Run after {@link prosemirror-tables/tableEditing} so `fixTables` has already normalized geometry. */
export function wikiTableHeaderRecoveryPlugin(): Plugin {
    return new Plugin({
        appendTransaction(trs, _oldState, newState) {
            if (!trs.some((tr) => tr.docChanged)) {
                return null;
            }

            const fixes: { pos: number; node: PMNode; next: PMNode }[] = [];
            newState.doc.descendants((node, pos) => {
                if (node.type.name !== 'table') {
                    return;
                }
                const next = promoteFirstRowCellsToHeader(node, newState.schema);
                if (next) {
                    fixes.push({ pos, node, next });
                }
            });
            if (fixes.length === 0) {
                return null;
            }

            fixes.sort((a, b) => b.pos - a.pos);
            let tr = newState.tr;
            for (const { pos, node, next } of fixes) {
                tr = tr.replaceWith(pos, pos + node.nodeSize, next);
            }
            return tr;
        },
    });
}
