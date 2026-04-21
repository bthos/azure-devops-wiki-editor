// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdoAttachmentService, type IWikiContext } from '../../src/services/attachment-service';
import { setWindowLocation } from '../helpers/mock-location';

function ctx(over: Partial<IWikiContext> = {}): IWikiContext {
    return {
        org: 'MyOrg',
        projectId: 'MyProject',
        wikiId: 'MyWiki',
        ...over,
    };
}

describe('AdoAttachmentService.normalizeAttachmentMarkdownPath', () => {
    it('trims and decodes percent escapes', () => {
        expect(AdoAttachmentService.normalizeAttachmentMarkdownPath('  /.attachments/a%20b.png  ')).toBe(
            '/.attachments/a b.png',
        );
    });

    it('strips trailing backslashes on attachment paths', () => {
        expect(AdoAttachmentService.normalizeAttachmentMarkdownPath('/.attachments/x.png\\\\')).toBe(
            '/.attachments/x.png',
        );
    });
});

describe('AdoAttachmentService.validateFile', () => {
    const svc = new AdoAttachmentService(ctx());

    it('rejects unknown extension', () => {
        const file = new File(['x'], 'a.exe', { type: 'application/octet-stream' });
        const r = svc.validateFile(file);
        expect(r.valid).toBe(false);
        expect(r.error).toContain('not supported');
    });

    it('rejects oversize file', () => {
        const big = new Uint8Array(18874369);
        const file = new File([big], 'huge.png', { type: 'image/png' });
        const r = svc.validateFile(file);
        expect(r.valid).toBe(false);
        expect(r.error).toContain('18MB');
    });

    it('accepts allowed png', () => {
        const file = new File([new Uint8Array([1])], 'pic.PNG', { type: 'image/png' });
        expect(svc.validateFile(file)).toEqual({ valid: true });
    });
});

describe('AdoAttachmentService.generateGuidSuffixedFilename', () => {
    it('uses crypto.randomUUID when available', () => {
        const svc = new AdoAttachmentService(ctx());
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        const name = svc.generateGuidSuffixedFilename('photo.jpg');
        expect(name).toMatch(/^photo-[a-f0-9]{32}\.jpg$/i);
        vi.mocked(crypto.randomUUID).mockRestore();
    });

    it('handles names without extension', () => {
        const svc = new AdoAttachmentService(ctx());
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
        const name = svc.generateGuidSuffixedFilename('README');
        expect(name).toMatch(/^README-[a-f0-9]{32}\.$/i);
        vi.mocked(crypto.randomUUID).mockRestore();
    });
});

describe('AdoAttachmentService.isDisplaySrcReady and toDisplaySrc', () => {
    beforeEach(() => {
        setWindowLocation('https://dev.azure.com');
    });

    it('isDisplaySrcReady is false without repositoryId or org', () => {
        const a = new AdoAttachmentService({ ...ctx(), org: undefined });
        expect(a.isDisplaySrcReady()).toBe(false);
        const b = new AdoAttachmentService(ctx());
        b.repositoryId = null;
        expect(b.isDisplaySrcReady()).toBe(false);
    });

    it('toDisplaySrc returns input when not ready or not attachment path', () => {
        const svc = new AdoAttachmentService(ctx());
        expect(svc.toDisplaySrc('/.attachments/x.png')).toBe('/.attachments/x.png');
        svc.repositoryId = 'rid';
        expect(svc.toDisplaySrc('')).toBe('');
        expect(svc.toDisplaySrc('/other/path')).toBe('/other/path');
    });

    it('toDisplaySrc builds Git Items URL when ready', () => {
        const svc = new AdoAttachmentService({ ...ctx(), wikiVersion: 'main' });
        svc.repositoryId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const url = svc.toDisplaySrc('/.attachments/file%20name.png');
        expect(url).toContain('_apis/git/repositories/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/Items');
        expect(url).toContain('path=%2F.attachments%2Ffile+name.png');
        expect(url).toContain('versionDescriptor.version=main');
    });

    it('uses wikiMaster when no wikiVersion', () => {
        const svc = new AdoAttachmentService(ctx());
        svc.repositoryId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const url = svc.toDisplaySrc('/.attachments/a.png');
        expect(url).toContain('versionDescriptor.version=wikiMaster');
    });
});

describe('AdoAttachmentService markdown path helpers', () => {
    const ready = (): AdoAttachmentService => {
        const svc = new AdoAttachmentService(ctx());
        svc.repositoryId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        return svc;
    };

    beforeEach(() => {
        setWindowLocation('https://dev.azure.com');
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: async () => ({}) })),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sanitizeMarkdownAttachmentParenEscapes strips trailing backslash before )', () => {
        const svc = ready();
        const md = '![](/.attachments/x.png\\))';
        expect(svc.sanitizeMarkdownAttachmentParenEscapes(md)).toBe('![](/.attachments/x.png))');
    });

    it('rewriteMarkdownToDisplayUrls leaves markdown when not display-ready', () => {
        const svc = new AdoAttachmentService(ctx());
        const md = '![](/.attachments/a.png)';
        expect(svc.rewriteMarkdownToDisplayUrls(md)).toBe(md);
    });

    it('rewriteMarkdownToDisplayUrls replaces attachment URLs when ready', () => {
        const svc = ready();
        const out = svc.rewriteMarkdownToDisplayUrls('![](/.attachments/a.png)');
        expect(out).not.toBe('![](/.attachments/a.png)');
        expect(out).toContain('_apis/git/repositories/');
    });

    it('markdownRestoreRelativeAttachmentPaths restores path from Git Items URL', () => {
        const svc = ready();
        const gitUrl =
            'https://dev.azure.com/MyOrg/MyProject/_apis/git/repositories/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/items?path=%2F.attachments%2Ffile.png&download=false';
        const md = `![](${gitUrl})`;
        const restored = svc.markdownRestoreRelativeAttachmentPaths(md);
        expect(restored).toBe('![](/.attachments/file.png)');
    });

    it('markdownRestoreRelativeAttachmentPaths restores from angle-bracket Git Items URL (destinationLiteral)', () => {
        const svc = ready();
        const gitUrl =
            'https://dev.azure.com/MyOrg/MyProject/_apis/git/repositories/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/items?path=%2F.attachments%2Ffile.png&download=false';
        const md = `![](<${gitUrl}>)`;
        const restored = svc.markdownRestoreRelativeAttachmentPaths(md);
        expect(restored).toBe('![](/.attachments/file.png)');
    });

    it('sanitizeMarkdownAttachmentParenEscapes strips \\) after path without requiring full image prefix', () => {
        const svc = ready();
        const md =
            '![alt](/.attachments/Remove_the_top_202512081505-c76b4e8d-b322-4cf0-8d57-127d322e0a57.jpeg\\)';
        expect(svc.sanitizeMarkdownAttachmentParenEscapes(md)).toBe(
            '![alt](/.attachments/Remove_the_top_202512081505-c76b4e8d-b322-4cf0-8d57-127d322e0a57.jpeg)',
        );
    });

    it('markdownRestoreRelativeAttachmentPaths percent-encodes spaces in attachment paths for valid markdown links', () => {
        const svc = ready();
        const decodedPath = '/.attachments/Additional Setup for New Environ_foo-dc616ac3.pdf';
        const gitUrl = `https://dev.azure.com/MyOrg/MyProject/_apis/git/repositories/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/items?path=${encodeURIComponent(decodedPath)}&download=false`;
        const md = `[label](${gitUrl})`;
        const restored = svc.markdownRestoreRelativeAttachmentPaths(md);
        expect(restored).toBe(
            '[label](/.attachments/Additional%20Setup%20for%20New%20Environ_foo-dc616ac3.pdf)',
        );
    });

    it('markdownRestoreRelativeAttachmentPaths leaves non-matching markdown', () => {
        const svc = ready();
        const md = '![](https://example.com/x.png)';
        expect(svc.markdownRestoreRelativeAttachmentPaths(md)).toBe(md);
    });
});

describe('AdoAttachmentService.hydrateRepositoryId', () => {
    beforeEach(() => {
        setWindowLocation('https://dev.azure.com');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('no-ops without org', async () => {
        const svc = new AdoAttachmentService({ ...ctx(), org: undefined });
        await svc.hydrateRepositoryId();
        expect(svc.repositoryId).toBeNull();
    });

    it('no-ops when repositoryId already set', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const svc = new AdoAttachmentService(ctx());
        svc.repositoryId = 'existing';
        await svc.hydrateRepositoryId();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sets repositoryId from JSON', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ repositoryId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }),
            }),
        );
        const svc = new AdoAttachmentService(ctx());
        await svc.hydrateRepositoryId();
        expect(svc.repositoryId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });

    it('reads PascalCase RepositoryId', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ RepositoryId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }),
            }),
        );
        const svc = new AdoAttachmentService(ctx());
        await svc.hydrateRepositoryId();
        expect(svc.repositoryId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    });

    it('ignores failed response', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
        );
        const svc = new AdoAttachmentService(ctx());
        await svc.hydrateRepositoryId();
        expect(svc.repositoryId).toBeNull();
    });
});

describe('AdoAttachmentService.uploadAttachment', () => {
    beforeEach(() => {
        setWindowLocation('https://dev.azure.com');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('throws when validation fails', async () => {
        const svc = new AdoAttachmentService(ctx());
        const file = new File(['x'], 'bad.exe');
        await expect(svc.uploadAttachment(file)).rejects.toThrow('not supported');
    });

    it('PUTs Base64 as application/octet-stream bytes and returns relative path on success', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                statusText: 'OK',
            }),
        );
        const svc = new AdoAttachmentService(ctx());
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000099');

        const file = new File([new Uint8Array([102, 111, 111])], 'a.png', { type: 'image/png' });
        const path = await svc.uploadAttachment(file);
        expect(path.startsWith('/.attachments/')).toBe(true);

        const putCall = vi.mocked(fetch).mock.calls.find((c) => (c[1] as RequestInit)?.method === 'PUT');
        expect(putCall).toBeDefined();
        const u = new URL(putCall![0] as string);
        expect(u.pathname).toMatch(/\/_apis\/wiki\/wikis\/MyWiki\/attachments$/);
        expect(u.searchParams.get('name')).toMatch(/^a-[a-f0-9]{32}\.png$/i);
        expect(u.searchParams.get('api-version')).toBe('7.1');
        const init = putCall![1] as RequestInit;
        const raw = init.body;
        const asUtf8 =
            typeof raw === 'string'
                ? raw
                : new TextDecoder().decode(raw instanceof ArrayBuffer ? raw : new Uint8Array(raw as ArrayBuffer));
        expect(asUtf8).toBe('Zm9v');
        expect(new Headers(init.headers).get('Content-Type')).toBe('application/octet-stream');
    });

    it('includes versionDescriptor when wikiVersion is set', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                statusText: 'Created',
            }),
        );
        const svc = new AdoAttachmentService({ ...ctx(), wikiVersion: 'wikiMaster' });
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000099');
        const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
        await svc.uploadAttachment(file);
        const putCall = vi.mocked(fetch).mock.calls.find((c) => (c[1] as RequestInit)?.method === 'PUT');
        const u = new URL(putCall![0] as string);
        expect(u.searchParams.get('versionDescriptor.versionType')).toBe('branch');
        expect(u.searchParams.get('versionDescriptor.version')).toBe('wikiMaster');
    });

    it('throws when PUT fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                statusText: 'Bad',
                text: async () => '{"message":"no"}',
            }),
        );
        const svc = new AdoAttachmentService(ctx());
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000099');
        const file = new File([new Uint8Array([103])], 'a.png', { type: 'image/png' });
        await expect(svc.uploadAttachment(file)).rejects.toThrow(/Failed to upload attachment: HTTP 400/);
    });

    it('throws when org is missing', async () => {
        const svc = new AdoAttachmentService({ ...ctx(), org: undefined });
        const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
        await expect(svc.uploadAttachment(file)).rejects.toThrow(/missing organization/);
    });
});

describe('AdoAttachmentService.readFileAsBase64', () => {
    it('resolves payload after comma', async () => {
        const svc = new AdoAttachmentService(ctx());
        const file = new File(['hi'], 't.txt', { type: 'text/plain' });
        const b64 = await svc.readFileAsBase64(file);
        expect(b64.length).toBeGreaterThan(0);
        expect(typeof b64).toBe('string');
    });
});
