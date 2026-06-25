import { describe, expect, it } from 'vitest';
import { createWikiMarkdownParser } from '../../src/editor/wiki-markdown-parser';
import { wikiMarkdownSerializer } from '../../src/editor/wiki-markdown-serializer';
import { wikiSchema } from '../../src/editor/wiki-schema';

describe('wiki video (ADO ::: video container)', () => {
    const parser = createWikiMarkdownParser();

    const sampleYt = 'https://www.youtube.com/embed/8nMgRZ_1KDQ?si=test';

    function collectVideoBody(doc: ReturnType<typeof parser.parse>): string {
        let body = '';
        doc.descendants((n) => {
            if (n.type.name === 'ado_video_block') {
                body = String(n.attrs['body'] ?? '');
            }
            return true;
        });
        return body;
    }

    it('parses ::: video … ::: as ado_video_block', () => {
        const md = `Intro\n\n::: video\n${sampleYt}\n:::\n\nDone.\n`;
        const doc = parser.parse(md, {});
        expect(collectVideoBody(doc)).toBe(sampleYt);
    });

    it('keeps full iframe HTML in body (not reduced to URL only)', () => {
        const iframe = `<iframe width="560" height="315" src="${sampleYt}" title="YouTube video player" frameborder="0"></iframe>`;
        const md = `::: video\n${iframe}\n:::\n`;
        const doc = parser.parse(md, {});
        expect(collectVideoBody(doc)).toBe(iframe);
    });

    it('round-trips iframe body through serialize and parse', () => {
        const iframe = `<iframe width="560" src="${sampleYt}" title="t"></iframe>`;
        const md = `::: video\n${iframe}\n:::\n`;
        const doc = parser.parse(md, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        const doc2 = parser.parse(out, {});
        expect(collectVideoBody(doc2)).toBe(iframe);
        expect(out).toContain('<iframe');
        expect(out).toContain('::: video');
    });

    it('preserves non-iframe single-line body when not a recognized embed URL', () => {
        const md = `::: video\njavascript:evil()\n:::\n`;
        const doc = parser.parse(md, {});
        expect(collectVideoBody(doc)).toBe('javascript:evil()');
    });

    it('stores raw mp4 line as body (preview layer may not embed)', () => {
        const mp4 = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
        const md = `::: video\n${mp4}\n:::\n`;
        const doc = parser.parse(md, {});
        expect(collectVideoBody(doc)).toBe(mp4);
    });

    it('round-trips allowed embed URL through serialize', () => {
        const md = `::: video\n${sampleYt}\n:::\n`;
        const doc = parser.parse(md, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('::: video');
        expect(out).toContain(':::');
        expect(out).toContain(sampleYt);

        const doc2 = parser.parse(out, {});
        expect(collectVideoBody(doc2)).toBe(sampleYt);
    });

    it('parses empty video container', () => {
        const md = `::: video\n:::\n`;
        const doc = parser.parse(md, {});
        expect(collectVideoBody(doc)).toBe('');
    });

    it('insert creates empty body', () => {
        const t = wikiSchema.nodes.ado_video_block;
        expect(t).toBeTruthy();
        const n = t!.create({ body: '' });
        expect(n.attrs['body']).toBe('');
    });
});
