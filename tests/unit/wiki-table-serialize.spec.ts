import { describe, expect, it } from 'vitest';
import { wikiSchema } from '../../src/editor/wiki-schema';
import { wikiMarkdownSerializer } from '../../src/editor/wiki-markdown-serializer';
import { createWikiMarkdownParser } from '../../src/editor/wiki-markdown-parser';

function cell(text: string, header: boolean) {
    const p = wikiSchema.nodes.paragraph.create({}, wikiSchema.text(text));
    const type = header ? wikiSchema.nodes.table_header : wikiSchema.nodes.table_cell;
    return type.create({}, [p]);
}

function emptyCell(header = false) {
    const p = wikiSchema.nodes.paragraph.create();
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

    it('serializes multiple paragraphs in a cell joined with <br> (ADO wiki line breaks)', () => {
        const p1 = wikiSchema.nodes.paragraph.create({}, wikiSchema.text('line 1'));
        const p2 = wikiSchema.nodes.paragraph.create({}, wikiSchema.text('line 2'));
        const p3 = wikiSchema.nodes.paragraph.create({}, wikiSchema.text('line 3'));
        const multi = wikiSchema.nodes.table_cell.create({}, [p1, p2, p3]);
        const row1 = wikiSchema.nodes.table_row.create({}, [emptyCell(true), emptyCell(true), emptyCell(true)]);
        const row2 = wikiSchema.nodes.table_row.create({}, [emptyCell(), multi, emptyCell()]);
        const table = wikiSchema.nodes.table.create({}, [row1, row2]);
        const doc = wikiSchema.nodes.doc.create({}, [table]);

        const md = wikiMarkdownSerializer.serialize(doc);
        expect(md).toContain('| line 1<br>line 2<br>line 3 |');
        expect(md).not.toMatch(/\| line 1 \|/);
    });

    it('serializes hard_break inside a cell as <br> (not backslash-newline)', () => {
        const hardBreak = wikiSchema.nodes.hard_break.create();
        const p = wikiSchema.nodes.paragraph.create({}, [
            wikiSchema.text('line 1'),
            hardBreak,
            wikiSchema.text('line 2'),
            hardBreak,
            wikiSchema.text('line 3'),
        ]);
        const multi = wikiSchema.nodes.table_cell.create({}, [p]);
        const row1 = wikiSchema.nodes.table_row.create({}, [emptyCell(true), emptyCell(true)]);
        const row2 = wikiSchema.nodes.table_row.create({}, [emptyCell(), multi]);
        const table = wikiSchema.nodes.table.create({}, [row1, row2]);
        const doc = wikiSchema.nodes.doc.create({}, [table]);

        const md = wikiMarkdownSerializer.serialize(doc);
        expect(md).toContain('line 1<br>line 2<br>line 3');
        expect(md).not.toContain('\\\n');
    });

    it('round-trips cell line breaks through markdown <br>', () => {
        const parser = createWikiMarkdownParser();
        const input = `| H1 | H2 |
| --- | --- |
| line 1<br>line 2<br>line 3 | x |
`;
        const doc = parser.parse(input, {});
        const md = wikiMarkdownSerializer.serialize(doc);
        expect(md).toContain('line 1<br>line 2<br>line 3');

        let hardBreaks = 0;
        doc.descendants((n) => {
            if (n.type.name === 'hard_break') hardBreaks += 1;
            return true;
        });
        expect(hardBreaks).toBe(2);

        const doc2 = parser.parse(md, {});
        let hardBreaks2 = 0;
        let cellText = '';
        doc2.descendants((n) => {
            if (n.type.name === 'hard_break') hardBreaks2 += 1;
            if (n.isText) cellText += n.text;
            return true;
        });
        expect(hardBreaks2).toBe(2);
        expect(cellText).toContain('line 1');
        expect(cellText).toContain('line 2');
        expect(cellText).toContain('line 3');
    });
});
