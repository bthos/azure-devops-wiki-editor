// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setWindowLocation } from '../helpers/mock-location';
import {
    adoWikiHeadingAnchorsFromPlainTexts,
    buildWikiPageUrl,
    encodeAdoWikiHeadingFragment,
    extractTocFromDocument,
    fetchChildPages,
    getPageNameFromPath,
    getWikiInfoFromUrl,
    getWikiPageIdFromUrl,
    normalizeAdoWikiHeadingIntermediate,
    renderTocHtml,
    renderTospChildListHtml,
    renderTospHtml,
    type WikiInfo,
    type WikiPage,
} from '../../src/ado-wiki-api';

describe('ADO wiki heading helpers', () => {
    it('normalizes spaces with Unicode Zs to hyphen', () => {
        expect(normalizeAdoWikiHeadingIntermediate('  Hello\u00A0World  ')).toBe('hello-world');
    });

    it('percent-encodes every byte when intermediate starts with a digit', () => {
        expect(encodeAdoWikiHeadingFragment('2d')).toBe('%32%64');
    });

    it('uses encodeURIComponent when not digit-leading', () => {
        expect(encodeAdoWikiHeadingFragment('a,b')).toBe('a%2Cb');
    });

    it('maps plain texts to intermediate and fragment', () => {
        const parts = adoWikiHeadingAnchorsFromPlainTexts(['Hello', '2d']);
        expect(parts[0]).toEqual({ intermediate: 'hello', fragment: 'hello' });
        expect(parts[1]).toEqual({ intermediate: '2d', fragment: '%32%64' });
    });
});

describe('getWikiInfoFromUrl', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns null when URL does not match wiki pattern', () => {
        setWindowLocation('https://example.com/foo');
        expect(getWikiInfoFromUrl()).toBeNull();
    });

    it('parses wiki with pagePath query and wikiVersion', () => {
        setWindowLocation(
            'https://dev.azure.com/MyOrg/MyProject/_wiki/wikis/My.wiki?pagePath=%2FFoo%2FBar&wikiVersion=main',
        );
        expect(getWikiInfoFromUrl()).toEqual({
            org: 'MyOrg',
            projectId: 'MyProject',
            wikiIdentifier: 'My.wiki',
            pagePath: '/Foo/Bar',
            version: 'main',
        });
    });

    it('maps wikiVersion=GBwikiMaster to wikiMaster for Git APIs (TF401175)', () => {
        setWindowLocation(
            'https://dev.azure.com/o/p/_wiki/wikis/Sample.wiki?pagePath=%2FPage%201&wikiVersion=GBwikiMaster',
        );
        expect(getWikiInfoFromUrl()?.version).toBe('wikiMaster');
    });

    it('extracts page path from numeric wiki segment and strips trailing slash', () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/W/10/Child%2F');
        const info = getWikiInfoFromUrl();
        expect(info?.pagePath).toBe('/Child');
    });

    it('defaults pagePath to slash when absent', () => {
        setWindowLocation('https://dev.azure.com/a/b/_wiki/wikis/WikiName');
        expect(getWikiInfoFromUrl()?.pagePath).toBe('/');
    });
});

describe('getWikiPageIdFromUrl', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns numeric id from path', () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/W/42/page');
        expect(getWikiPageIdFromUrl()).toBe(42);
    });

    it('returns null when segment missing', () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/W');
        expect(getWikiPageIdFromUrl()).toBeNull();
    });
});

describe('getPageNameFromPath', () => {
    it('returns last segment', () => {
        expect(getPageNameFromPath('/a/b/Hello')).toBe('Hello');
    });

    it('returns path when no slash match', () => {
        expect(getPageNameFromPath('nosep')).toBe('nosep');
    });
});

describe('buildWikiPageUrl', () => {
    beforeEach(() => {
        setWindowLocation('https://dev.azure.com');
    });

    it('builds pagePath query URL', () => {
        const wiki: WikiInfo = {
            org: 'O',
            projectId: 'P',
            wikiIdentifier: 'W',
            pagePath: '/',
        };
        expect(buildWikiPageUrl(wiki, '/Docs/One')).toBe(
            'https://dev.azure.com/O/P/_wiki/wikis/W?pagePath=%2FDocs%2FOne',
        );
    });
});

describe('renderTocHtml', () => {
    it('renders empty state', () => {
        const html = renderTocHtml([]);
        expect(html).toContain('No headings found');
    });

    it('renders entries with escaped text and anchors', () => {
        const html = renderTocHtml([
            { level: 1, text: 'A & B', anchor: 'a-%26-b' },
            { level: 2, text: 'Child', anchor: 'child' },
        ]);
        expect(html).toContain('aria-label="Table of contents"');
        expect(html).toContain('href="#a-%26-b"');
        expect(html).toContain('A &amp; B');
        expect(html).toContain('href="#child"');
    });
});

describe('renderTospChildListHtml and renderTospHtml', () => {
    const wiki: WikiInfo = {
        org: 'o',
        projectId: 'p',
        wikiIdentifier: 'w',
        pagePath: '/',
    };

    it('renders empty TOSP list', () => {
        expect(renderTospChildListHtml([], wiki)).toContain('No child pages');
    });

    it('sorts by order and escapes link targets', () => {
        const pages: WikiPage[] = [
            { id: 2, path: '/b/Beta', order: 20, remoteUrl: 'https://x/Beta' },
            { id: 1, path: '/a/Alpha', order: 10, remoteUrl: '' },
        ];
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w');
        const html = renderTospChildListHtml(pages, wiki);
        expect(html.indexOf('Alpha')).toBeLessThan(html.indexOf('Beta'));
        expect(html).toContain('href="https://x/Beta"');
        expect(html).toContain('pagePath=');
    });

    it('renders nested sub-pages as nested lists', () => {
        const pages: WikiPage[] = [
            {
                id: 1,
                path: '/parent',
                order: 0,
                remoteUrl: '',
                subPages: [
                    { id: 2, path: '/parent/child', order: 0, remoteUrl: '' },
                    {
                        id: 3,
                        path: '/parent/other',
                        order: 1,
                        remoteUrl: '',
                        subPages: [{ id: 4, path: '/parent/other/deep', order: 0, remoteUrl: '' }],
                    },
                ],
            },
        ];
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w');
        const html = renderTospChildListHtml(pages, wiki);
        expect(html).toContain('parent');
        expect(html).toContain('child');
        expect(html).toContain('deep');
        expect((html.match(/<ul/g) || []).length).toBe(3);
        expect(html.indexOf('child')).toBeLessThan(html.indexOf('deep'));
    });

    it('wraps list in renderTospHtml', () => {
        const html = renderTospHtml([], wiki);
        expect(html).toContain('tosp-container');
        expect(html).toContain('Child Pages');
    });
});

describe('extractTocFromDocument', () => {
    it('skips empty headings and assigns levels', () => {
        const root = document.createElement('div');
        root.innerHTML = '<h1>One</h1><h2></h2><h3>Three</h3>';
        const toc = extractTocFromDocument(root);
        expect(toc).toHaveLength(2);
        expect(toc[0]).toMatchObject({ level: 1, text: 'One' });
        expect(toc[1]).toMatchObject({ level: 3, text: 'Three' });
    });
});

describe('fetchChildPages', () => {
    const wiki: WikiInfo = {
        org: 'o',
        projectId: 'p',
        wikiIdentifier: 'w',
        pagePath: '/x',
    };

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns [] on non-JSON failure', async () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w/99/z');
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'err',
            }),
        );
        const pages = await fetchChildPages(wiki);
        expect(pages).toEqual([]);
    });

    it('maps subPages from camelCase response by page id', async () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w/7/foo');
        const raw = [{ id: 1, path: '/a', order: 1, remoteUrl: 'https://r' }];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                expect(url).toContain('/_apis/wiki/wikis/w/pages/7?');
                expect(url).toContain('recursionLevel=full');
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ subPages: raw }),
                });
            }),
        );
        const pages = await fetchChildPages(wiki);
        expect(pages).toEqual([
            { id: 1, path: '/a', order: 1, remoteUrl: 'https://r', gitItemPath: undefined },
        ]);
    });

    it('maps nested subPages when API returns full recursion', async () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w/7/foo');
        const raw = [
            {
                id: 1,
                path: '/root',
                order: 0,
                remoteUrl: '',
                subPages: [{ id: 2, path: '/root/leaf', order: 0, remoteUrl: 'https://leaf' }],
            },
        ];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ subPages: raw }),
            }),
        );
        const pages = await fetchChildPages(wiki);
        expect(pages).toHaveLength(1);
        expect(pages[0].subPages).toHaveLength(1);
        expect(pages[0].subPages![0]).toMatchObject({ id: 2, path: '/root/leaf' });
    });

    it('accepts PascalCase SubPages', async () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w/1/x');
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ SubPages: [{ id: 2, path: '/p', order: 0 }] }),
            }),
        );
        const pages = await fetchChildPages(wiki);
        expect(pages[0].id).toBe(2);
    });

    it('falls back to path query when id returns empty', async () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w/5/x');
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ subPages: [] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    subPages: [{ id: 3, path: '/c', order: 0, remoteUrl: '' }],
                }),
            });
        vi.stubGlobal('fetch', fetchMock);
        const pages = await fetchChildPages(wiki);
        expect(pages).toHaveLength(1);
        expect(fetchMock.mock.calls[1][0]).toContain('path=%2Fx');
    });

    it('retries without version when versioned requests return empty', async () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w/3/x');
        const withVersion = { org: 'o', projectId: 'p', wikiIdentifier: 'w', pagePath: '/x', version: 'b' };
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ subPages: [] }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ subPages: [] }) })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ subPages: [{ id: 9, path: '/z', order: 0, remoteUrl: '' }] }),
            });
        vi.stubGlobal('fetch', fetchMock);
        const pages = await fetchChildPages(withVersion);
        expect(pages).toHaveLength(1);
        const urls = fetchMock.mock.calls.map((c) => c[0] as string);
        expect(urls.some((u) => u.includes('versionDescriptor.version=b'))).toBe(true);
        expect(urls.some((u) => !u.includes('versionDescriptor'))).toBe(true);
    });

    it('uses path-only flow when no page id in URL', async () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w');
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ subPages: [{ id: 1, path: '/q', order: 0, remoteUrl: '' }] }),
            }),
        );
        const pages = await fetchChildPages(wiki);
        expect(pages).toHaveLength(1);
    });

    it('returns [] on AbortError', async () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w/1/x');
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        );
        await expect(fetchChildPages(wiki, new AbortController().signal)).resolves.toEqual([]);
    });
});
