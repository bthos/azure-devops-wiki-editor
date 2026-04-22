import { describe, expect, it } from 'vitest';
import { wikiSchema } from '../../src/editor/wiki-schema';
import { wikiMarkdownSerializer } from '../../src/editor/wiki-markdown-serializer';

function cell(text: string, header: boolean) {
    const p = wikiSchema.nodes.paragraph.create({}, wikiSchema.text(text));
    const type = header ? wikiSchema.nodes.table_header : wikiSchema.nodes.table_cell;
    return type.create({}, [p]);
}

describe('wikiMarkdownSerializer + tables', () => {
    it('serializes a 2x2 GFM-style table with header separator', () => {
        const row1 = wikiSchema.nodes.table_row.create({}, [cell('A', true), cell('B', true)]);
        const row2 = wikiSchema.nodes.table_row.create({}, [cell('1', false), cell('2', false)]);
        const table = wikiSchema.nodes.table.create({}, [row1, row2]);
        const doc = wikiSchema.nodes.doc.create({}, [table]);

        const md = wikiMarkdownSerializer.serialize(doc);
        expect(md).toMatch(/\| A \| B \|/);
        expect(md).toMatch(/\| --- \| --- \|/);
        expect(md).toMatch(/\| 1 \| 2 \|/);
    });

    it('serializes header-only table with separator', () => {
        const row = wikiSchema.nodes.table_row.create({}, [cell('X', true), cell('Y', true)]);
        const table = wikiSchema.nodes.table.create({}, [row]);
        const doc = wikiSchema.nodes.doc.create({}, [table]);
        const md = wikiMarkdownSerializer.serialize(doc);
        expect(md).toContain('| X | Y |');
        expect(md).toContain('---');
    });
});
