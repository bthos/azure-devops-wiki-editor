import type { Node } from 'prosemirror-model';
import type { MarkdownSerializerState } from 'prosemirror-markdown';

function rowIsAllHeaders(row: Node): boolean {
    let ok = row.childCount > 0;
    row.forEach((cell) => {
        if (cell.type.name !== 'table_header') ok = false;
    });
    return ok;
}

/** Serialize one table row as `| a | b |`. */
function serializeTableRow(state: MarkdownSerializerState, row: Node): void {
    state.write('|');
    row.forEach((cell) => {
        state.write(' ');
        const first = cell.firstChild;
        if (first && first.type.name === 'paragraph') {
            state.renderInline(first, false);
        } else if (first) {
            state.renderContent(cell);
        }
        state.write(' |');
    });
    state.write('\n');
}

function writeSeparator(state: MarkdownSerializerState, headerRow: Node): void {
    state.write('|');
    headerRow.forEach(() => {
        state.write(' --- |');
    });
    state.write('\n');
}

/**
 * GFM-style pipe table (header row + `---` separator, then body rows).
 */
export function serializeTable(state: MarkdownSerializerState, node: Node): void {
    state.ensureNewLine();
    const rows: Node[] = [];
    node.forEach((r) => rows.push(r));

    if (rows.length === 0) {
        state.closeBlock(node);
        return;
    }

    if (rowIsAllHeaders(rows[0])) {
        serializeTableRow(state, rows[0]);
        writeSeparator(state, rows[0]);
        for (let i = 1; i < rows.length; i++) {
            serializeTableRow(state, rows[i]);
        }
    } else {
        for (const row of rows) {
            serializeTableRow(state, row);
        }
    }
    state.closeBlock(node);
}
