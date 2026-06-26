import { describe, expect, it } from 'vitest';
import { createWikiMarkdownParser } from '../../src/editor/wiki-markdown-parser';
import { wikiMarkdownSerializer } from '../../src/editor/wiki-markdown-serializer';
import { matchWikiWorkItemRef } from '../../src/editor/wiki-work-item-match';

describe('wiki work item matcher', () => {
    it('matches # + two or more digits with word boundary', () => {
        expect(matchWikiWorkItemRef('See #12 x', 4, 12)?.id).toBe('12');
        expect(matchWikiWorkItemRef('See #12345.', 4, 12)?.id).toBe('12345');
    });

    it('does not match single digit id', () => {
        expect(matchWikiWorkItemRef('#1 ', 0, 3)).toBeNull();
    });

    it('does not match URL fragment after /', () => {
        const s = 'https://x.com/#99';
        expect(matchWikiWorkItemRef(s, s.indexOf('#'), s.length)).toBeNull();
    });

    it('does not match after word char (fragment style)', () => {
        expect(matchWikiWorkItemRef('a#12 z', 1, 8)).toBeNull();
    });

    it('does not match hex-like continuation after digits', () => {
        expect(matchWikiWorkItemRef('#12345abc', 0, 10)).toBeNull();
    });
});

describe('wiki work item markdown', () => {
    const parser = createWikiMarkdownParser();

    function collectWorkItemIds(doc: ReturnType<typeof parser.parse>): string[] {
        const ids: string[] = [];
        doc.descendants((n) => {
            if (n.isText && n.marks.some((m) => m.type.name === 'wikiWorkItem')) {
                const m = n.marks.find((mk) => mk.type.name === 'wikiWorkItem');
                ids.push(String(m?.attrs['id'] ?? ''));
            }
            return true;
        });
        return ids;
    }

    it('parses #12345 in prose into wikiWorkItem mark', () => {
        const doc = parser.parse('Track #12345 here.\n', {});
        expect(collectWorkItemIds(doc)).toEqual(['12345']);
    });

    it('round-trips as plain #12345 in markdown', () => {
        const input = 'Track #12345 here.\n';
        const doc = parser.parse(input, {});
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toContain('#12345');
        expect(out).not.toMatch(/data-work-item/);
        const doc2 = parser.parse(out, {});
        expect(collectWorkItemIds(doc2)).toEqual(['12345']);
    });

    it('does not treat inline code as work item', () => {
        const doc = parser.parse('Use `#999` literal.\n', {});
        expect(collectWorkItemIds(doc)).toEqual([]);
    });

    it('does not treat ATX heading line as inline work item', () => {
        const doc = parser.parse('# Title line\n\nBody #99.\n', {});
        expect(collectWorkItemIds(doc)).toEqual(['99']);
    });

    it('does not match #abcdef as work item (letters)', () => {
        const doc = parser.parse('Color #abcdef end.\n', {});
        expect(collectWorkItemIds(doc)).toEqual([]);
    });
});
