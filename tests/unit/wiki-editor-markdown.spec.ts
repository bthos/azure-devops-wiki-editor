import { describe, expect, it } from 'vitest';
import { createWikiMarkdownParser } from '../../src/editor/wiki-markdown-parser';
import { wikiMarkdownSerializer } from '../../src/editor/wiki-markdown-serializer';
import { wikiSchema } from '../../src/editor/wiki-schema';
import { postprocessAdoMarkers, preprocessMentions } from '../../src/utils/wiki-markers';

describe('wiki markdown parser + serializer', () => {
    const parser = createWikiMarkdownParser();

    it('parses [[_TOC_]] as ado_toc atom', () => {
        const doc = parser.parse('# Title\n\n[[_TOC_]]\n', {});
        const names: string[] = [];
        doc.descendants((n) => {
            names.push(n.type.name);
            return true;
        });
        expect(names).toContain('ado_toc');
        expect(names).toContain('heading');
    });

    it('round-trips TOC and TOSP markers', () => {
        const input = 'Intro\n\n[[_TOC_]]\n\n[[_TOSP_]]\n\nDone.';
        const doc = parser.parse(input, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('[[_TOC_]]');
        expect(out).toContain('[[_TOSP_]]');
    });

    it('round-trips raw html_block in markdown (markdown-it html, ADO-style)', () => {
        const input = 'Intro\n\n<div>Block HTML</div>\n\nAfter.';
        const doc = parser.parse(input, {});
        let stored = '';
        doc.descendants((n) => {
            if (n.type.name === 'ado_html_block') {
                stored = String(n.attrs['html'] ?? '');
            }
            return true;
        });
        expect(stored).toContain('Block HTML');
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('<div>Block HTML</div>');
        const doc2 = parser.parse(out, {});
        let stored2 = '';
        doc2.descendants((n) => {
            if (n.type.name === 'ado_html_block') {
                stored2 = String(n.attrs['html'] ?? '');
            }
            return true;
        });
        expect(stored2).toContain('Block HTML');
    });

    it('round-trips inline HTML via ado_html_inline (excluding task-list checkbox markup)', () => {
        const input = 'Hello <strong>x</strong> world.\n';
        const doc = parser.parse(input, {});
        const fragments: string[] = [];
        doc.descendants((n) => {
            if (n.type.name === 'ado_html_inline') {
                fragments.push(String(n.attrs['html'] ?? ''));
            }
            return true;
        });
        expect(fragments.some((f) => f.includes('strong'))).toBe(true);
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('<strong>x</strong>');
        const doc2 = parser.parse(out, {});
        const fragments2: string[] = [];
        doc2.descendants((n) => {
            if (n.type.name === 'ado_html_inline') {
                fragments2.push(String(n.attrs['html'] ?? ''));
            }
            return true;
        });
        expect(fragments2.some((f) => f.includes('strong'))).toBe(true);
    });

    it('round-trips heading and bold after mention preprocess', () => {
        const raw = 'Hello **world**\n\nMention: @<user@example.com>\n';
        const md = preprocessMentions(raw);
        const doc = parser.parse(md, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('**world**');
        expect(out).toContain('@‹user@example.com›');
    });

    it('parses @‹Display› as userMention mark (ADO-style chip + profile card data)', () => {
        const md = preprocessMentions('Hi @<Jane Doe>.\n');
        const doc = parser.parse(md, {});
        let found = false;
        doc.descendants((n) => {
            if (n.isText && n.marks.some((m) => m.type.name === 'userMention')) {
                found = true;
                expect(n.text).toBe('Jane Doe');
                const mk = n.marks.find((m) => m.type.name === 'userMention');
                expect(mk?.attrs['userName']).toBe('Jane Doe');
            }
            return true;
        });
        expect(found).toBe(true);
        const out = postprocessAdoMarkers(wikiMarkdownSerializer.serialize(doc));
        expect(out).toContain('@<Jane Doe>');
    });

    it('round-trips GFM strikethrough (markdown-it `s` tokens)', () => {
        const input = 'Line with ~~struck~~ text.\n';
        const doc = parser.parse(input, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('~~struck~~');
    });

    it('round-trips GFM task lists (unchecked and checked)', () => {
        const input = ['- [ ] Todo item', '- [x] Done item', ''].join('\n');
        const doc = parser.parse(input, {});
        const items: { checked: unknown }[] = [];
        doc.descendants((n) => {
            if (n.type.name === 'list_item') items.push({ checked: n.attrs['checked'] });
            return true;
        });
        expect(items.length).toBe(2);
        expect(items[0].checked).toBe(false);
        expect(items[1].checked).toBe(true);
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('- [ ] Todo item');
        expect(out).toContain('- [x] Done item');
    });

    it('re-parsing serialized task markdown still yields task list_item (not plain + bracket text)', () => {
        const input = ['- [ ] Todo item', ''].join('\n');
        const doc = parser.parse(input, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        const doc2 = parser.parse(out, {});
        const items: { checked: unknown }[] = [];
        doc2.descendants((n) => {
            if (n.type.name === 'list_item') items.push({ checked: n.attrs['checked'] });
            return true;
        });
        expect(items).toHaveLength(1);
        expect(items[0].checked).toBe(false);
    });

    it('uses hyphen bullets for plain lists (ADO-style)', () => {
        const input = ['- plain one', '- plain two', ''].join('\n');
        const doc = parser.parse(input, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('- plain one');
        expect(out).toContain('- plain two');
        expect(out).not.toMatch(/^\* /m);
    });

    it('round-trips a GFM pipe table (parse → serialize)', () => {
        const input = ['| A | B |', '| --- | --- |', '| 1 | 2 |', ''].join('\n');
        const doc = parser.parse(input, {});
        const names: string[] = [];
        doc.descendants((n) => {
            names.push(n.type.name);
            return true;
        });
        expect(names).toContain('table');
        expect(names).toContain('table_row');
        expect(names).toContain('table_header');
        expect(names).toContain('table_cell');

        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toMatch(/\| A \| B \|/);
        expect(out).toMatch(/\| --- \| --- \|/);
        expect(out).toMatch(/\| 1 \| 2 \|/);
    });

    it('serializes /.attachments/ image with angle-bracket destination (ADO parity)', () => {
        const img = wikiSchema.nodes.image.create({
            src: '/.attachments/foo%20a.png',
            alt: 'shot',
            title: 'cap',
        });
        const doc = wikiSchema.node('doc', null, [wikiSchema.nodes.paragraph.create(null, [img])]);
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('![shot](</.attachments/foo%20a.png> "cap")');
    });

    it('serializes /.attachments/ link with angle-bracket destination (ADO parity)', () => {
        const mk = wikiSchema.marks.link.create({ href: '/.attachments/f.pdf', title: null });
        const doc = wikiSchema.node('doc', null, [
            wikiSchema.nodes.paragraph.create(null, [wikiSchema.text('download', [mk])]),
        ]);
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('[download](</.attachments/f.pdf>)');
    });
});
