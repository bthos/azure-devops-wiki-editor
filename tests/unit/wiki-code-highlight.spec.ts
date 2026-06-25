// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import {
    applyWikiCodeReadonlyHighlight,
    resolveWikiCodeHighlightLanguage,
    WIKI_CODE_HIGHLIGHT_MAX_CHARS,
    WIKI_CODE_HIGHLIGHT_LANGUAGES,
} from '../../src/editor/wiki-code-highlight';

describe('resolveWikiCodeHighlightLanguage', () => {
    it('resolves typescript and common aliases', () => {
        expect(resolveWikiCodeHighlightLanguage('typescript')).toBe('typescript');
        expect(resolveWikiCodeHighlightLanguage('TS')).toBe('ts');
        expect(resolveWikiCodeHighlightLanguage('tsx')).toBe('tsx');
        expect(resolveWikiCodeHighlightLanguage('language-typescript')).toBe('typescript');
    });

    it('returns null for unknown languages', () => {
        expect(resolveWikiCodeHighlightLanguage('foobar')).toBeNull();
        expect(resolveWikiCodeHighlightLanguage('')).toBeNull();
        expect(resolveWikiCodeHighlightLanguage('   ')).toBeNull();
    });
});

describe('applyWikiCodeReadonlyHighlight', () => {
    it('emits multiple hljs token spans for typescript sample', () => {
        const code = document.createElement('code');
        applyWikiCodeReadonlyHighlight(code, 'typescript', 'const x: number = 1;\n');

        expect(code.classList.contains('hljs')).toBe(true);
        const tokens = code.querySelectorAll('[class*="hljs-"]');
        expect(tokens.length).toBeGreaterThan(1);
    });

    it('leaves plain text for unknown params (no throw)', () => {
        const code = document.createElement('code');
        code.className = 'hljs';
        code.innerHTML = '<span>stale</span>';
        applyWikiCodeReadonlyHighlight(code, 'not-a-real-lang-xyz', 'hello');

        expect(code.classList.contains('hljs')).toBe(false);
        expect(code.textContent).toBe('hello');
        expect(code.querySelector('span')).toBeNull();
    });

    it('skips highlight when body exceeds cap', () => {
        const code = document.createElement('code');
        const body = 'x'.repeat(WIKI_CODE_HIGHLIGHT_MAX_CHARS + 1);
        applyWikiCodeReadonlyHighlight(code, 'typescript', body);

        expect(code.classList.contains('hljs')).toBe(false);
        expect(code.textContent?.length).toBe(WIKI_CODE_HIGHLIGHT_MAX_CHARS + 1);
    });
});

describe('WIKI_CODE_HIGHLIGHT_LANGUAGES', () => {
    it('documents v1 support matrix size', () => {
        expect(WIKI_CODE_HIGHLIGHT_LANGUAGES.length).toBe(10);
    });
});
