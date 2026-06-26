import { describe, expect, it } from 'vitest';
import {
    canWikiVideoUseNativeMediaElement,
    extractIframeSrcFromEmbedHtml,
    normalizeWikiVideoEmbedInput,
    normalizeWikiVideoEmbedUrl,
} from '../../src/editor/wiki-video-url';

describe('normalizeWikiVideoEmbedUrl', () => {
    it('allows https URLs', () => {
        expect(normalizeWikiVideoEmbedUrl(' https://example.org/path/to/a.mp4 ')).toBe('https://example.org/path/to/a.mp4');
    });

    it('rejects http', () => {
        expect(normalizeWikiVideoEmbedUrl('http://example.org/x.mp4')).toBeNull();
    });

    it('rejects javascript:', () => {
        expect(normalizeWikiVideoEmbedUrl('javascript:alert(1)')).toBeNull();
    });

    it('rejects data:', () => {
        expect(normalizeWikiVideoEmbedUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('rejects URLs with embedded credentials', () => {
        expect(normalizeWikiVideoEmbedUrl('https://user:pass@example.org/a.mp4')).toBeNull();
    });
});

describe('normalizeWikiVideoEmbedInput', () => {
    const yt = 'https://www.youtube.com/embed/8nMgRZ_1KDQ?si=x';

    it('accepts YouTube embed HTTPS URL', () => {
        expect(normalizeWikiVideoEmbedInput(`  ${yt}  `)).toBe(yt);
    });

    it('rejects raw mp4 even when https', () => {
        expect(
            normalizeWikiVideoEmbedInput('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'),
        ).toBeNull();
    });

    it('rejects YouTube watch URL (not iframe embed)', () => {
        expect(normalizeWikiVideoEmbedInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    });

    it('accepts SharePoint / Stream embed URL', () => {
        const u =
            'https://contoso-my.sharepoint.com/personal/x/_layouts/15/embed.aspx?UniqueId=36f3ee18-3a05-4bdd-bc05-66e937838c43';
        expect(normalizeWikiVideoEmbedInput(u)?.startsWith('https://contoso-my.sharepoint.com/')).toBe(true);
    });

    it('extracts src from full iframe HTML', () => {
        const html = `<iframe width="560" height="315" src="${yt}" title="YouTube video player" frameborder="0"></iframe>`;
        expect(normalizeWikiVideoEmbedInput(html)).toBe(yt);
    });

    it('extracts src from multiline iframe', () => {
        const html = `<iframe\n  src="${yt}"\n  title="x"></iframe>`;
        expect(normalizeWikiVideoEmbedInput(html)).toBe(yt);
    });
});

describe('extractIframeSrcFromEmbedHtml', () => {
    it('returns null without iframe', () => {
        expect(extractIframeSrcFromEmbedHtml('https://www.youtube.com/embed/x')).toBeNull();
    });
});

describe('canWikiVideoUseNativeMediaElement', () => {
    it('is true for obvious static media paths', () => {
        expect(canWikiVideoUseNativeMediaElement('https://cdn.example/x.mp4')).toBe(true);
        expect(canWikiVideoUseNativeMediaElement('https://cdn.example/y.webm')).toBe(true);
    });

    it('is false for pages like YouTube watch URLs', () => {
        expect(
            canWikiVideoUseNativeMediaElement('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
        ).toBe(false);
    });
});
