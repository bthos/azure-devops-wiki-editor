import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { gapCursor } from 'prosemirror-gapcursor';
import { tableEditing } from 'prosemirror-tables';

import { wikiSchema } from '../../src/editor/wiki-schema';
import { insertSimpleTable, insertWikiTable } from '../../src/editor/wiki-table-commands';

const tablePlugins = [gapCursor(), tableEditing()];

describe('wiki-table-commands', () => {
    it('insertSimpleTable builds header + body rows', () => {
        const table = insertSimpleTable(wikiSchema, 2, 3, true);
        expect(table.type.name).toBe('table');
        expect(table.childCount).toBe(3);
        expect(table.firstChild?.firstChild?.type.name).toBe('table_header');
        expect(table.child(1).firstChild?.type.name).toBe('table_cell');
    });

    it('insertWikiTable replaces an empty paragraph with a table', () => {
        const emptyP = wikiSchema.nodes.paragraph.create();
        const doc = wikiSchema.node('doc', null, [emptyP]);
        const state = EditorState.create({
            doc,
            selection: TextSelection.create(doc, 1),
            plugins: tablePlugins,
        });
        const cmd = insertWikiTable(2, 2, true);
        let next: EditorState | undefined;
        const ok = cmd(state, (tr) => {
            next = state.apply(tr);
        });
        expect(ok).toBe(true);
        expect(next).toBeDefined();
        expect(next!.doc.childCount).toBe(1);
        expect(next!.doc.firstChild?.type.name).toBe('table');
    });

    it('insertWikiTable inserts after a non-empty paragraph', () => {
        const p1 = wikiSchema.nodes.paragraph.create(null, [wikiSchema.text('hello')]);
        const p2 = wikiSchema.nodes.paragraph.create();
        const doc = wikiSchema.node('doc', null, [p1, p2]);
        const mid = 4; // inside first paragraph text ("hello")
        const state = EditorState.create({
            doc,
            selection: TextSelection.create(doc, mid),
            plugins: tablePlugins,
        });
        const cmd = insertWikiTable(1, 2, true);
        let next: EditorState | undefined;
        expect(cmd(state, (tr) => { next = state.apply(tr); })).toBe(true);
        expect(next!.doc.childCount).toBe(3);
        expect(next!.doc.child(0).type.name).toBe('paragraph');
        expect(next!.doc.child(1).type.name).toBe('table');
        expect(next!.doc.child(2).type.name).toBe('paragraph');
    });
});
