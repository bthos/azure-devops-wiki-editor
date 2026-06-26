import { describe, expect, it } from 'vitest';
import { createWikiMarkdownParser } from '../../src/editor/wiki-markdown-parser';
import { wikiMarkdownSerializer } from '../../src/editor/wiki-markdown-serializer';
import { renderWikiMathKatex } from '../../src/editor/wiki-math-katex';

describe('wiki math markdown', () => {
    const parser = createWikiMarkdownParser();

    it('parses inline $…$ into wiki_math_inline', () => {
        const doc = parser.parse('Hello $a^2 + b^2 = c^2$ world.\n', {});
        const tex: string[] = [];
        doc.descendants((n) => {
            if (n.type.name === 'wiki_math_inline') {
                tex.push(String(n.attrs['tex'] ?? ''));
            }
            return true;
        });
        expect(tex).toEqual(['a^2 + b^2 = c^2']);
    });

    it('still parses legacy \\(...\\) into wiki_math_inline', () => {
        const doc = parser.parse('Hello \\(a^2 + b^2 = c^2\\) world.\n', {});
        const tex: string[] = [];
        doc.descendants((n) => {
            if (n.type.name === 'wiki_math_inline') {
                tex.push(String(n.attrs['tex'] ?? ''));
            }
            return true;
        });
        expect(tex).toEqual(['a^2 + b^2 = c^2']);
    });

    it('round-trips inline math as $…$', () => {
        const input = 'x is $n^2$ here.\n';
        const doc = parser.parse(input, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('$n^2$');
        expect(out).not.toContain('\\(');
        const doc2 = parser.parse(out, {});
        const again: string[] = [];
        doc2.descendants((n) => {
            if (n.type.name === 'wiki_math_inline') {
                again.push(String(n.attrs['tex'] ?? ''));
            }
            return true;
        });
        expect(again).toEqual(['n^2']);
    });

    it('normalizes \\(…\\) to $…$ on serialize', () => {
        const doc = parser.parse('x is \\(n^2\\) here.\n', {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('$n^2$');
        expect(out).not.toContain('\\(');
    });

    it('parses $$ display block', () => {
        const input = 'Intro\n\n$$\nE = mc^2\n$$\n\nOut.\n';
        const doc = parser.parse(input, {});
        let tex = '';
        doc.descendants((n) => {
            if (n.type.name === 'wiki_math_block') {
                tex = String(n.attrs['tex'] ?? '');
            }
            return true;
        });
        expect(tex.trim()).toBe('E = mc^2');
    });

    it('normalizes one-line \\[...\\] to $$ on serialize', () => {
        const input = 'x\n\n\\[ \\sum_{i=1}^n i \\]\n\ny\n';
        const doc = parser.parse(input, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('$$\n');
        expect(out).toContain('\\sum_{i=1}^n i');
        expect(out).not.toMatch(/\\\[/);
        const doc2 = parser.parse(out, {});
        let tex = '';
        doc2.descendants((n) => {
            if (n.type.name === 'wiki_math_block') {
                tex = String(n.attrs['tex'] ?? '');
            }
            return true;
        });
        expect(tex).toContain('\\sum_{i=1}^n i');
    });

    it('does not treat bare currency amounts as math', () => {
        const input = 'Price is $50 and $19.99 today.\n';
        const doc = parser.parse(input, {});
        let found = false;
        doc.descendants((n) => {
            if (n.type.name === 'wiki_math_inline' || n.type.name === 'wiki_math_block') {
                found = true;
            }
            return true;
        });
        expect(found).toBe(false);
    });

    it('does not treat $50$ as inline math (currency heuristic)', () => {
        const doc = parser.parse('x $50$ y\n', {});
        let found = false;
        doc.descendants((n) => {
            if (n.type.name === 'wiki_math_inline') {
                found = true;
            }
            return true;
        });
        expect(found).toBe(false);
    });
});

describe('wiki math KaTeX hardening', () => {
    it('does not emit executable href from \\href in source', () => {
        const out = renderWikiMathKatex(String.raw`\href{javascript:alert(1)}{x}`, false);
        expect(out.ok).toBe(true);
        expect(out.html.toLowerCase()).not.toContain('javascript:');
    });
});
