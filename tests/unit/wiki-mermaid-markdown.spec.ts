import { describe, expect, it } from 'vitest';
import { createWikiMarkdownParser } from '../../src/editor/wiki-markdown-parser';
import { wikiMarkdownSerializer } from '../../src/editor/wiki-markdown-serializer';

describe('wiki mermaid (ADO container + fenced code_block)', () => {
    const parser = createWikiMarkdownParser();

    it('parses ::: mermaid … ::: as code_block with params mermaid', () => {
        const md = 'Intro\n\n::: mermaid\nflowchart TD\n  A --> B\n:::\n\nDone.\n';
        const doc = parser.parse(md, {});
        let found = false;
        doc.descendants((n) => {
            if (n.type.name === 'code_block') {
                const p = String(n.attrs['params'] ?? '').trim().toLowerCase();
                if (p === 'mermaid') {
                    found = true;
                    expect(n.textContent.replace(/\r\n/g, '\n').trim()).toContain('flowchart TD');
                }
            }
            return true;
        });
        expect(found).toBe(true);
    });

    it('serializes mermaid code_block as ADO ::: container', () => {
        const md = '::: mermaid\nsequenceDiagram\n  Alice->>Bob: hello\n:::\n';
        const doc = parser.parse(md, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('::: mermaid');
        expect(out).toContain(':::');
        expect(out).toContain('sequenceDiagram');
        expect(out).not.toMatch(/```\s*mermaid/i);
        const doc2 = parser.parse(out, {});
        let params = '';
        let text = '';
        doc2.descendants((n) => {
            if (n.type.name === 'code_block') {
                params = String(n.attrs['params'] ?? '');
                text = n.textContent;
            }
            return true;
        });
        expect(params.trim().toLowerCase()).toBe('mermaid');
        expect(text).toContain('Alice->>Bob');
    });

    it('still parses fenced ```mermaid and normalizes serialize to ::: mermaid', () => {
        const md =
            '```mermaid\nsequenceDiagram\n  Alice->>Bob: hello\n```\n';
        const doc = parser.parse(md, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('::: mermaid');
        expect(out).toContain(':::\n');
        const doc2 = parser.parse(out, {});
        let params = '';
        doc2.descendants((n) => {
            if (n.type.name === 'code_block') {
                params = String(n.attrs['params'] ?? '');
            }
            return true;
        });
        expect(params.trim().toLowerCase()).toBe('mermaid');
    });
});
