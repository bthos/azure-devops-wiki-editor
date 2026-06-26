import { describe, expect, it } from 'vitest';

import { type Node as PMNode } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { tableNodeTypes } from 'prosemirror-tables';

import { wikiTableHeaderRecoveryPlugin } from '../../src/editor/wiki-table-header-recovery';
import { wikiSchema } from '../../src/editor/wiki-schema';

function types() {
    return tableNodeTypes(wikiSchema);
}

function p(text: string): PMNode {
    return wikiSchema.nodes.paragraph.create(null, wikiSchema.text(text));
}

function dataCell(text: string): PMNode {
    return types().cell!.create(null, [p(text)]);
}

function headerCell(text: string): PMNode {
    return types().header_cell!.create(null, [p(text)]);
}

function tableRow(cells: PMNode[]): PMNode {
    return types().row!.create(null, cells);
}

function table(rows: PMNode[]): PMNode {
    return types().table!.create(null, rows);
}

describe('wikiTableHeaderRecoveryPlugin', () => {
    it('converts first-row table_cell nodes to table_header after a doc change', () => {
        const bodyFirst = tableRow([dataCell('A'), dataCell('B')]);
        const bodySecond = tableRow([dataCell('C'), dataCell('D')]);
        const tbl = table([bodyFirst, bodySecond]);
        const doc = wikiSchema.node('doc', null, [tbl, wikiSchema.node('paragraph', null, wikiSchema.text('x'))]);

        const state = EditorState.create({
            doc,
            plugins: [wikiTableHeaderRecoveryPlugin()],
        });

        const end = state.doc.content.size;
        const tr = state.tr.delete(end - 1, end);
        const next = state.apply(tr);

        const t = next.doc.child(0);
        expect(t.type.name).toBe('table');
        expect(t.child(0).child(0).type.name).toBe('table_header');
        expect(t.child(0).child(1).type.name).toBe('table_header');
        expect(t.child(1).child(0).type.name).toBe('table_cell');
        expect(t.child(0).textContent).toBe('AB');
    });

    it('does nothing when the first row is already all header cells', () => {
        const r0 = tableRow([headerCell('A'), headerCell('B')]);
        const r1 = tableRow([dataCell('C'), dataCell('D')]);
        const tbl = table([r0, r1]);
        const doc = wikiSchema.node('doc', null, [tbl, wikiSchema.node('paragraph', null, wikiSchema.text('x'))]);
        const state = EditorState.create({ doc, plugins: [wikiTableHeaderRecoveryPlugin()] });
        const end = state.doc.content.size;
        const next = state.apply(state.tr.delete(end - 1, end));
        const t = next.doc.child(0);
        expect(t.child(0).child(0).type.name).toBe('table_header');
        expect(t.eq(state.doc.child(0))).toBe(true);
    });
});
